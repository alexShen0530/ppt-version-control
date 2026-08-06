from openai import OpenAI
import config


def call_qwen(user_message: str, system_message: str,
              model: str = "qwen3-vl-32b-thinking") -> str:
    """
    调用阿里云百炼Qwen模型
    :param user_message: 用户输入
    :param system_message: 系统提示词
    :param model: 模型名称
    :return: 模型生成的文本
    """
    client = OpenAI(
        api_key=config.BAILIAN_API_KEY,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
    )

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message}
        ]
    )

    return response.choices[0].message.content


if __name__ == "__main__":
    # 简单测试
    result = call_qwen(
        user_message="你好，用一句话介绍一下你自己",
        system_message="你是一个乐于助人的AI助手"
    )
    print(result)
