import json

from openai import OpenAI
from typing import Optional, List, Dict, Any
import config
import system_prompt


class DeepSeekClient:
    """DeepSeek API客户端 - 使用官方OpenAI库"""

    def __init__(self, timeout: int = 60):
        """
        初始化DeepSeek客户端

        Args:
            timeout: 请求超时时间（秒）
        """
        self.client = OpenAI(
            api_key=config.DEEPSEEK_API_KEY,
            base_url=config.DEEPSEEK_BASE_URL,
            timeout=timeout
        )

    def chat_completion(
            self,
            messages: List[Dict[str, Any]],
            model: str = "deepseek-v4-flash",
            temperature: float = 0.7,
            max_tokens: Optional[int] = None,
            stream: bool = False,
            **kwargs
    ) -> Any:
        """
        发送聊天补全请求

        Args:
            messages: 消息列表 [{"role": "user", "content": "hello"}]
            model: 模型名称
            temperature: 温度参数 (0-2)
            max_tokens: 最大生成token数
            stream: 是否流式输出
            **kwargs: 其他参数

        Returns:
            API响应对象
        """
        return self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream,
            **kwargs
        )

    def get_models(self) -> List[str]:
        """获取可用模型列表"""
        models = self.client.models.list()
        return [model.id for model in models.data]


def deepseek_chat(
        prompt: str,
        model: str = "deepseek-v4-flash",
        system_prompt: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: Optional[int] = 12000,
        stream: bool = False,
        image_paths: Optional[List[str]] = None,
        high_resolution: bool = False,
) -> str:
    """
    简化的DeepSeek聊天函数

    Args:
        prompt: 用户输入
        model: 模型名称
        system_prompt: 系统提示词
        temperature: 温度参数
        max_tokens: 最大生成token数
        stream: 是否流式输出
        image_paths: 随提示词一起发送的本地图片路径列表
        high_resolution: 是否保留图片原始分辨率

    Returns:
        生成的文本内容
    """
    client = DeepSeekClient()

    messages: List[Dict[str, Any]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})

    messages.append({"role": "user", "content": prompt})

    response = client.chat_completion(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=stream
    )

    if stream:
        # 流式返回时，收集所有内容
        full_content = ""
        for chunk in response:
            if chunk.choices:
                delta = chunk.choices[0].delta
                if delta and delta.content:
                    full_content += delta.content
        return full_content
    else:
        return response.choices[0].message.content


if __name__ == "__main__":

    SYSTEM_MESSAGE = system_prompt.ppt_version_diff

    old_json_path = r"C:\Users\shen.xin\Desktop\work\local_download_dir\AI落地应用场景规划V3_pages.json"
    new_json_path = r"C:\Users\shen.xin\Desktop\work\local_download_dir\AI落地应用场景规划V3 - 副本_pages.json"

    with open(old_json_path, "r", encoding="utf-8") as f:
        old_data = json.load(f)

    with open(new_json_path, "r", encoding="utf-8") as f:
        new_data = json.load(f)

    input_text = f"""
    旧版：
    {json.dumps(old_data, ensure_ascii=False, indent=2)}

    新版：
    {json.dumps(new_data, ensure_ascii=False, indent=2)}
    """

    # 调用 DeepSeek 进行代码审查
    try:
        result = deepseek_chat(
            prompt=input_text,
            system_prompt=SYSTEM_MESSAGE,
        )
        print(result)
    except Exception as e:
        print(f"错误: {e}")
