import json

import requests
from feishu_token import token_manager


def send_to_feishu(msg_data, text: str):
    """
    回复原消息（把结果发回飞书群里，挂在原PPT消息下面，支持markdown渲染）
    :param msg_data: 消息数据（需要其中的message_id）
    :param text: 要发送的内容（支持markdown语法）
    """
    message_id = msg_data["message_id"]

    url = f"https://open.feishu.cn/open-apis/im/v1/messages/{message_id}/reply"
    headers = {
        "Authorization": f"Bearer {token_manager.get_token()}",
        "Content-Type": "application/json"
    }
    # 用消息卡片承载，卡片内的markdown元素可渲染标题/加粗/列表等

    # post 富文本消息
    post_content = {
        "zh_cn": {
            "title": "PPT版本内容差异",
            "content": [
                [
                    {
                        "tag": "md",
                        "text": text
                    }
                ]
            ]
        }
    }

    payload = {
        "msg_type": "post",
        "content": json.dumps(post_content, ensure_ascii=False)
    }

    try:
        resp = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=30
        )

        data = resp.json()

        if data.get("code") == 0:
            print(f"📤 已回复到飞书群 | 消息ID: {message_id}")
        else:
            print(f"❌ 回复失败: {data}")

    except requests.RequestException as e:
        print(f"❌ 请求飞书接口失败: {e}")
