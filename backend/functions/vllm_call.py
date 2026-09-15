from openai import OpenAI

from backend.functions.common_utils import encode_image
import re

VLLM_URL = "http://172.16.200.96:8000/v1"

client = OpenAI(
    base_url=VLLM_URL,
    api_key="EMPTY",
)


def chat_with_vllm(
    user_message: str,
    system_message: str,
    image_paths: list[str] | None = None,
    model: str = "Qwen3-VL-8B-Instruct",
    high_resolution: bool = True,
) -> str:
    """调用 vLLM 部署的 Qwen2.5 文本或视觉模型，支持多张本地图片。"""
    if image_paths:
        content = [{"type": "text", "text": user_message}]
        for image_path in image_paths:
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{encode_image(image_path, high_resolution)}"
                },
            })
    else:
        content = user_message

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": content},
            ],
            temperature=0.1,
            top_p=0.9,
            max_tokens=8192,
            extra_body={
                "top_k": 20,
                "repetition_penalty": 1.05
            },
        )

        result = response.choices[0].message.content or ""
        result = result.strip()
        result = re.sub(r"^```(?:json)?\s*", "", result)
        result = re.sub(r"\s*```$", "", result)
        return result
    except Exception as exc:
        raise RuntimeError(f"调用 vLLM 模型失败: {exc}") from exc

if __name__ == "__main__":
    system_message = """
你是一名 PPT 页面内容解析助手。

你的任务是分析一张 PPT 页面截图，并将页面内容提炼成适合后续“页面匹配、版本识别、差异分析”的结构化文本。

请严格遵循以下规则：

1. 文本优先
- 尽可能识别并提取页面中所有可见文字。
- 包括：标题、副标题、正文、列表、表格文字、图表标签、流程图文字、图片中的文字、数字、单位、日期、百分比等。
- 尽量保留原始文字含义和关键数字，不要随意改写。
- 对明显识别不清的文字，不要猜测，可省略或标记为“无法识别”。

2. 图片内容
- 如果图片中包含文字、数据、说明、标签等有实际信息的内容，优先提取这些信息。
- 如果图片只是照片、示意图、背景图等，没有重要文字，只需用一句简短的话描述图片主要内容。
- 不需要详细描述颜色、构图、人物姿态、背景细节等无关信息。

3. 图标和装饰元素
- 普通图标、箭头、圆点、线条、装饰形状等无需详细描述。
- 只有当图标本身表达业务含义时，才进行简短描述，例如：
  - “云端图标”
  - “数据库图标”
  - “车辆图标”
  - “向右流程箭头”
- 不要对纯装饰元素进行冗余描述。

4. 图表和流程图
- 优先提取图表标题、轴名称、图例、关键数值、趋势和结论。
- 流程图应提取每个主要节点的文字及节点之间的关系。
- 不需要逐像素描述布局。

5. 表格
- 尽量完整提取表头和关键单元格内容。
- 保留数字、单位、百分比、时间等重要字段。
- 如果表格很大，可提炼主要字段和关键数据，不需要描述边框样式。

6. 输出要求
- 不要写“这是一张PPT”“图片中显示”等无意义前缀。
- 不做主观评价。
- 不扩展页面中不存在的信息。
- 输出应简洁、稳定、信息密度高。
- 目标是让同一页的小幅修改仍然保留较高文本相似度，同时能够体现真正的内容变化。

请按以下格式输出：

【标题】
页面主标题，没有则留空。

【主要文本】
按阅读顺序提取页面中的主要文字内容。

【图片文字】
提取图片、截图、示意图中的有效文字；没有则留空。

【图表/流程/表格】
提取图表、流程图、表格中的关键内容和关系；没有则留空。

【视觉元素简述】
仅简要描述有业务含义的图片或图标，例如：
“车辆示意图”“云平台架构图”“数据库图标”。
如果没有重要视觉元素则留空。
"""
    result = chat_with_vllm('',system_message, model="Qwen3-VL-8B-Instruct", image_paths=[r"C:\Users\shen.xin\Desktop\work\local_download_dir\希迪智驾年中报告1\page_6.png"])
    print(result)

