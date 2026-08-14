import json
import os
import re
from concurrent.futures import ThreadPoolExecutor

from feishu_event import FeishuEventListener
from feishu_downloader import ppt_downloader
from functions.doc_intelligence import parse_document, merge_markdown_by_page
from db_store import document_store
from feishu_sender import send_to_feishu
from functions.common_utils import collect_multimedia_ocr, enrich_pages_with_ocr
from functions.concurrent_util import execute_parallel_with_fallback
from functions.page_matcher import match_pages
from prompt_message import ppt_page_diff
import config


def _parse_page_diff(raw_result: str) -> dict:
    try:
        result = json.loads(raw_result)
        if isinstance(result, dict):
            return result
    except (json.JSONDecodeError, TypeError):
        pass
    return {
        "has_difference": True,
        "summary": "该页面差异分析失败，请人工检查。",
    }


def on_message_received(msg_data):
    """收到消息时的回调"""
    # 1. 判断是不是PPT
    if not ppt_downloader.is_ppt_file(msg_data):
        # 不是PPT，忽略
        msg_type = msg_data["msg_type"]
        print(f"ℹ️  非PPT文件，跳过（类型: {msg_type}）")
        return

    file_path = None
    try:
        # 2. 下载PPT
        file_path = ppt_downloader.download_ppt(msg_data)
        if not file_path:
            print("❌ PPT下载失败，跳过")
            return

        # 3. 文档解析与多媒体识别并行执行
        with ThreadPoolExecutor(max_workers=2) as executor:
            document_future = executor.submit(parse_document, file_path)
            multimedia_future = executor.submit(collect_multimedia_ocr, file_path)
            result = document_future.result()
            multimedia_result = multimedia_future.result()

        # 4. 按页合并Markdown内容
        page_text_list = merge_markdown_by_page(result)

        # 4.5 清除图片占位符，合并结构化图片与视频识别结果
        page_text_list = enrich_pages_with_ocr(
            file_path, page_text_list, multimedia_result
        )

        # 5. 存入本地数据库（一个PPT一条记录）
        file_name = json.loads(msg_data["content"])["file_name"]
        doc_id = document_store.save_document(
            file_name,
            page_text_list,
            file_path=file_path,
            message_id=msg_data["message_id"],
            chat_id=msg_data["chat_id"]
        )
        print(f"🎉 全流程完成 | 文档ID: {doc_id}")

        # 6. 查找历史版本，生成差异汇总
        # 去掉版本号和扩展名得到基础名：AI落地应用场景规划V2.pptx -> AI落地应用场景规划
        base_name = re.sub(r'[Vv]\d+\.[Pp][Pp][Tt][Xx]?$', '', file_name)
        old_doc = document_store.find_latest_history(base_name, exclude_id=doc_id)

        if not old_doc:
            print("ℹ️  当前ppt没有发现历史版本 差异汇总跳过")
            send_to_feishu(msg_data, "当前ppt没有发现历史版本，差异汇总跳过")
            return

        relations = match_pages(old_doc["page_text_list"], page_text_list)
        relations_to_compare = [
            relation
            for relation in relations
            if not (
                relation.get("relation") == "matched"
                and abs((relation.get("similarity") or 0) - 1.0) < 1e-9
            )
        ]
        fallback = json.dumps({
            "has_difference": True,
            "summary": "该页面差异分析失败，请人工检查。",
        }, ensure_ascii=False)
        tasks = [
            (ppt_page_diff, (relation,), {}, f"page-diff-{index}", fallback)
            for index, relation in enumerate(relations_to_compare, start=1)
        ]
        page_diff_results = execute_parallel_with_fallback(
            tasks,
            max_workers=2,
            timeout_seconds=180,
            max_retries=2,
        )
        parsed_results = [_parse_page_diff(item) for item in page_diff_results]
        summaries = [
            item["summary"].strip()
            for item in parsed_results
            if item.get("has_difference") and item.get("summary", "").strip()
        ]
        diff_result = (
            "\n\n".join(
                f"{index}. {summary}"
                for index, summary in enumerate(summaries, start=1)
            )
            or "两个版本未发现明显内容差异。"
        )

        print(f"📝 差异汇总（对比历史版本: {old_doc['file_name']}）:\n{diff_result}")
        send_to_feishu(msg_data, f"📝 差异汇总（对比历史版本: {old_doc['file_name']}）\n{diff_result}")

    except Exception as e:
        print(f"❌ 处理PPT失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # 7. 安全删除下载的临时PPT文件及提取的图片目录
        if file_path and os.path.exists(file_path):
            try:
                # 先删图片目录（与PPT同名的子目录）
                image_dir = os.path.join(config.DOWNLOAD_DIR, os.path.splitext(os.path.basename(file_path))[0])
                if os.path.isdir(image_dir):
                    import shutil
                    shutil.rmtree(image_dir)
                    print(f"🗑️  已删除图片目录: {image_dir}")

                os.remove(file_path)
                print(f"🗑️  已删除临时文件: {file_path}")
            except Exception as e:
                print(f"⚠️  删除临时文件失败: {file_path} | {e}")


if __name__ == "__main__":
    listener = FeishuEventListener(on_message_received)
    listener.start()
