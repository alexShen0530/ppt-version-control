import config
from feishu_token import token_manager
import requests
import os
import math
import time

MAX_SIMPLE_UPLOAD = 20 * 1024 * 1024  # 20MB 以下用全量上传


def upload_ppt_to_wiki(ppt_path, file_name):
    """
    上传 PPT 到知识库指定节点
    自动判断：小于 20MB 用全量上传，大于 20MB 自动走分片上传
    """
    url_upload_all = "https://open.feishu.cn/open-apis/drive/v1/files/upload_all"
    url_prepare = "https://open.feishu.cn/open-apis/drive/v1/files/upload_prepare"
    url_part = "https://open.feishu.cn/open-apis/drive/v1/files/upload_part"
    url_finish = "https://open.feishu.cn/open-apis/drive/v1/files/upload_finish"

    headers = {
        "Authorization": f"Bearer {token_manager.get_token()}"
    }

    file_size = os.path.getsize(ppt_path)
    wiki_token = config.WIKI_TOKEN

    # ========== 小于 20MB：全量上传 ==========
    if file_size <= MAX_SIMPLE_UPLOAD:
        print(f"📤 文件较小 ({file_size / 1024 / 1024:.1f} MB)，使用全量上传...")

        with open(ppt_path, "rb") as f:
            files = {
                "file": (file_name, f, "application/vnd.openxmlformats-officedocument.presentationml.presentation")
            }
            data = {
                "file_name": file_name,
                "parent_type": "wiki",
                "parent_node": wiki_token,
                "size": str(file_size)
            }
            response = requests.post(url_upload_all, headers=headers, files=files, data=data)

        result = response.json()
        if result.get("code") == 0:
            file_info = result["data"]
            print(f"✅ 上传成功！")
            print(f"   文件 token: {file_info['file_token']}")
            print(f"   文件 url: {file_info['url']}")
            return file_info
        else:
            print(f"❌ 上传失败: {result}")
            return None

    # ========== 大于 20MB：分片上传 ==========
    else:
        print(f"📤 文件较大 ({file_size / 1024 / 1024:.1f} MB)，使用分片上传...")

        session = requests.Session()
        session.headers.update(headers)

        # --- 第1步：预上传 ---
        print("   📡 预上传中...")
        prepare_data = {
            "file_name": file_name,
            "parent_type": "wiki",
            "parent_node": wiki_token,
            "size": file_size
        }
        resp = session.post(url_prepare, json=prepare_data)
        prepare_result = resp.json()

        if prepare_result.get("code") != 0:
            print(f"   ❌ 预上传失败: {prepare_result}")
            return None

        upload_id = prepare_result["data"]["upload_id"]
        block_size = prepare_result["data"].get("block_size", 4 * 1024 * 1024)  # 从返回结果获取分片大小
        total_chunks = math.ceil(file_size / block_size)

        print(f"   分片大小: {block_size / 1024 / 1024:.1f} MB")
        print(f"   分片数量: {total_chunks} 片")

        # --- 第2步：分片上传 ---
        print(f"   📦 分片上传中...")
        with open(ppt_path, "rb") as f:
            for i in range(total_chunks):
                chunk_data = f.read(block_size)
                chunk_size = len(chunk_data)
                seq = i

                # 重试机制：最多重试3次
                success = False
                for retry in range(3):
                    files = {"file": (file_name, chunk_data)}
                    part_data = {
                        "upload_id": upload_id,
                        "seq": seq,
                        "size": str(chunk_size)  # 确保是字符串
                    }

                    resp = session.post(url_part, files=files, data=part_data)
                    part_result = resp.json()

                    if part_result.get("code") == 0:
                        success = True
                        break
                    else:
                        print(f"      片 {seq} 第 {retry + 1} 次尝试失败: {part_result.get('msg')}")
                        if retry < 2:
                            time.sleep(1)  # 重试前等1秒

                if success:
                    progress = ((i + 1) / total_chunks) * 100
                    print(f"      片 {i + 1}/{total_chunks} ✓ ({progress:.0f}%) - {chunk_size / 1024:.1f} KB")
                else:
                    print(f"      ❌ 片 {seq} 上传最终失败: {part_result}")
                    return None

        # --- 第3步：完成上传 ---
        print("   🔗 合并分片...")
        finish_data = {
            "upload_id": upload_id,
            "block_num": total_chunks
        }
        resp = session.post(url_finish, json=finish_data)
        finish_result = resp.json()

        if finish_result.get("code") == 0:
            file_info = finish_result["data"]
            print(f"✅ 上传成功！")
            print(f"   文件 token: {file_info['file_token']}")
            print(f"   文件 url: {file_info['url']}")
            return file_info
        else:
            print(f"❌ 合并失败: {finish_result}")
            return None


if __name__ == "__main__":
    PPT_PATH = r"C:\Users\shen.xin\Downloads\AI&财务\AI落地应用场景规划V1.pptx"  # PPT 文件路径
    PPT_NAME = "AI落地应用场景规划V1.pptx"  # 上传后的文件名

    # 上传 PPT
    print("📤 正在上传 PPT 到知识库...")
    result = upload_ppt_to_wiki(PPT_PATH, PPT_NAME)

    if result:
        print()
        print("🎉 全部完成！")
