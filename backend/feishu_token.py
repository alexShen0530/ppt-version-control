import requests
import time
import config


class FeishuToken:
    """飞书token管理类，自动刷新"""

    def __init__(self):
        self._token = None
        self._expire_time = 0  # 过期时间戳

    def get_token(self):
        """获取有效的tenant_access_token"""
        # 如果token还没过期，直接返回
        if self._token and time.time() < self._expire_time - 60:  # 提前60秒刷新
            return self._token

        # 过期了，重新获取
        self._refresh_token()
        return self._token

    def _refresh_token(self):
        """刷新token"""
        url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
        payload = {
            "app_id": config.APP_ID,
            "app_secret": config.APP_SECRET
        }

        resp = requests.post(url, json=payload)
        data = resp.json()

        if data.get("code") == 0:
            self._token = data["tenant_access_token"]
            self._expire_time = time.time() + data["expire"]
            print(f"✅ Token获取成功，有效期{data['expire']}秒")
        else:
            raise Exception(f"❌ Token获取失败: {data.get('msg')}")


# 全局单例，直接导入用
token_manager = FeishuToken()