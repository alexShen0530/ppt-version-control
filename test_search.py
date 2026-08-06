import requests
import os
import json
from feishu_token import token_manager

# ============ 配置 ============
WIKI_SPACE_ID = "7667856627999738844"  # 换成你的space_id


def search_wiki(query, space_id=None, page_size=10):
    """
    使用应用身份搜索知识库文档。
    """
    token = token_manager.get_token()

    url = "https://open.feishu.cn/open-apis/search/v2/doc_wiki/search"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    body = {
        "query": query,
        "page_size": page_size,
        "wiki_filter": {}
    }

    if space_id:
        body["wiki_filter"]["space_ids"] = [space_id]

    resp = requests.post(url, headers=headers, json=body)
    try:
        result = resp.json()
    except requests.exceptions.JSONDecodeError:
        print(f"❌ 接口返回的不是 JSON（HTTP {resp.status_code}）: {resp.text[:300]}")
        return []

    if resp.ok and result.get("code") == 0:
        items = result.get("data", {}).get("res_units", [])
        print(f"✅ 搜索成功，找到 {len(items)} 条结果")
        print()

        for i, item in enumerate(items, 1):
            meta = item.get("result_meta", {})
            print(f"  {i}. [{item.get('entity_type', '?')}] {item.get('title_highlighted', '无标题')}")
            print(f"     所有者: {meta.get('owner_name', '')}")
            print(f"     链接: {meta.get('url', '')}")
            print()

        return items
    else:
        print(f"❌ 搜索失败（HTTP {resp.status_code}）: {result}")
        return []


# ============ 测试一下 ============
if __name__ == "__main__":
    print("=" * 50)
    print("🔍 知识库搜索测试")
    print("=" * 50)
    print()

    # 换成你知识库里有的关键词
    search_keyword = "AI落地应用"  # 👈 换成你知识库里有的关键词

    print(f"搜索关键词: {search_keyword}")
    print(f"知识库space_id: {WIKI_SPACE_ID}")
    print()

    results = search_wiki(search_keyword, WIKI_SPACE_ID)

    if results:
        print("-" * 50)
        print("💡 搜索成功！下一步我们读取文档内容")
    else:
        print("-" * 50)
        print("⚠️ 还是没搜到？试试：")
        print("   1. 换个更通用的关键词（比如首页、文档等）")
        print("   2. 不传 space_id，搜所有知识库")
        print("   3. 检查应用有没有知识库的读取权限")
