import requests
import os
import json
import config
from feishu_token import token_manager


class PptDownloader:
    """PPT下载器"""

    def __init__(self):
        # 确保下载目录存在
        os.makedirs(config.DOWNLOAD_DIR, exist_ok=True)

    def is_ppt_file(self, msg_data):
        """判断消息是不是PPT文件"""
        if msg_data["msg_type"] != "file":
            return False

        # 解析消息内容
        content = json.loads(msg_data["content"])
        file_name = content.get("file_name", "")

        # 判断是不是PPT
        return file_name.endswith(('.ppt', '.pptx'))

    def download_ppt(self, msg_data):
        """
        下载PPT文件
        :param msg_data: 消息数据
        :return: 下载后的文件路径
        """
        content = json.loads(msg_data["content"])
        file_key = content["file_key"]
        file_name = content["file_name"]
        message_id = msg_data["message_id"]

        print(f"⬇️  开始下载: {file_name}")

        # 下载文件
        url = f"https://open.feishu.cn/open-apis/im/v1/messages/{message_id}/resources/{file_key}"
        params = {"type": "file"}
        headers = {
            "Authorization": f"Bearer {token_manager.get_token()}"
        }

        resp = requests.get(url, params=params, headers=headers)

        if resp.status_code != 200:
            print(f"❌ 下载失败: {resp.status_code}")
            return None

        # 保存文件
        file_path = os.path.join(config.DOWNLOAD_DIR, file_name)

        # 处理重名文件
        if os.path.exists(file_path):
            name, ext = os.path.splitext(file_name)
            file_path = os.path.join(config.DOWNLOAD_DIR, f"{name}_{message_id[-8:]}{ext}")

        with open(file_path, "wb") as f:
            f.write(resp.content)

        print(f"✅ 下载完成: {file_path}")
        return file_path


# 全局单例
ppt_downloader = PptDownloader()