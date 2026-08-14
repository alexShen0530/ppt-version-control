import json

from call_qwen import call_qwen_vision
from vllm_call import chat_with_vllm
from deepseek_util import deepseek_chat


def ppt_page_diff(relation: dict) -> str:
    """分析一组已匹配的 PPT 页面关系，返回 JSON 格式的差异结果。"""
    relation_type = relation.get("relation")
    if relation_type not in ["matched", "moved", "added", "deleted"]:
        raise ValueError(f"不支持的页面关系类型: {relation_type}")

    matched_moved_msg = """
    ## Task Procedure
    1. 对于**text**字段: 进行逐字比较，但忽略空格、换行、标点和 Markdown格式不同而导致的差异，找出有实际意义的内容变化；
    2. 对于**images**字段，
        - 如果raw_text字段不为空，则仅根据 `raw_text` 比较图片内容差异，`summary` 仅用于辅助匹配图片，不参与差异判断；
        - 如果 `raw_text` 为空，则根据 `summary` 的核心语义比较图片内容；
        - 比较 `summary` 时，以图片的主体、场景、动作和表达含义是否发生变化为准；描述粒度、措辞或同义表达不同**不算差异**；
    3. 对于**videos**字段，根据**summary**进行内容差异比较，以图片的主体、场景、动作和表达含义是否发生变化为准；描述粒度、措辞或同义表达不同**不算差异**；
    4. 忽略 OCR 轻微误差及 images 数组顺序变化；
    """

    added_deleted_msg = """
    ## Task Procedure
    概括精简总结新版新增页面或者新版删除页面的核心内容，has_difference 必须为 true。
    """


    system_message = f"""
    ## Role
    你是一名 PPT 页面版本差异分析助手，负责比较同一份 PPT 旧版页面和新版页面的内容差异。
    用户上传的文本中包含新旧两个ppt对应页面的解析结果, 格式如下：
    {{
      "page_num": 1,
      "text": "页面文本",
      "images": [{{"raw_text": "图片原文", "summary": "图片理解"}}],
      "videos": [{{"summary": "视频理解"}}]
    }}

    {matched_moved_msg if relation_type in ["matched", "moved"] else added_deleted_msg}

    ## Output
    只输出合法 JSON，不要输出 Markdown、代码块或任何额外说明。

    存在实际差异时：
    {{
      "has_difference": true,
      "summary": "旧版第 X 页 → 新版第 X 页：说明具体发生了什么变化，包括新增、删除、修改等实际差异。"
    }}

    没有实际差异时：
    {{
      "has_difference": false,
      "summary": ""
    }}
    """

    return deepseek_chat(
        prompt=json.dumps(relation, ensure_ascii=False),
        system_prompt=system_message,
        # model="Qwen2.5-VL-7B-Instruct",
    )


def ppt_image_describer(image_path: str) -> str:
    system_message = """
## Role
你是一个专业的图片内容理解与文本提取助手，能够像人一样理解图片中的文字、结构、流程、图表和视觉信息。

## Goal
对输入图片进行内容理解，并输出两部分结果：
1. **原文本**：提取图片中实际存在的文字，并按照图片原有结构整理。
2. **图片理解**：结合文字和视觉内容，用简洁自然语言说明图片主要表达的信息。
重点是准确提取和理解图片内容，不进行无关的版式、颜色、图标或设计分析。

## Task Procedure
### 1. 原文本提取
识别图片中实际可见的文字，包括：
* 标题
* 正文
* 模块名称
* 模块说明
* 编号
* 标签
* 流程步骤
* 表格内容
* 图表中的文字
* 补充说明
根据图片中的位置、层级和逻辑关系整理文字，使结果保持原图的信息结构。
要求：
* **必须保留原文**
* 不翻译、不总结、不改写原意、不添加图片中不存在的文字、同一模块中的文字合理合并、忽略纯装饰性图标、连接线、背景、边框等元素
* 如果图片中完全没有文字，则原文本输出为空字符串。

### 2. 图片内容理解
综合图片中的文字、图形、流程、结构和视觉关系，理解图片真正表达的内容。
要求：
* 用自然语言概括图片表达的核心信息
* 可以说明模块之间的关系、流程关系或业务含义
* 如果图片主要由图形组成，即使没有文字，也需要根据可见内容进行理解
* 不需要描述颜色、尺寸、位置、图标样式等无业务意义的信息
* 不输出诸如 Layout、Connections、Icons、Diagram Analysis 等视觉分析内容
* 不逐项描述图片长什么样
* 不重复大段原文本
* 图片理解应简洁，重点说明“这张图在表达什么”

## Objective
必须严格输出合法 JSON，格式如下：
{
"raw_text": "图片中的原始文本",
"summary": "对图片核心内容的简洁理解"
}

要求：
只输出合法 JSON，不要使用** Markdown 代码块**，不要输出 ```json 或 ```，不要输出任何额外说明。
    """

    return chat_with_vllm('', system_message,[image_path], model="Qwen2.5-VL-7B-Instruct")


def ppt_video_describer(image_paths: list[str]) -> str:
    system_message = """
## Role
你是一个专业的视频内容理解助手。
输入为同一个视频按时间顺序截取的三张关键帧，分别代表视频的开头、中间和结尾。
请将三张图片作为同一个连续视频进行综合理解，而不是分别描述每一张图片。

## Task
结合三帧画面内容及前后变化，判断视频主要展示了什么内容，并生成一段简洁、客观的内容摘要。

重点关注：
* 视频展示的主体对象
* 展示的数据、产品、页面或业务内容
* 三帧之间发生的主要变化
* 视频是在进行产品演示、操作流程、数据展示、案例展示还是其他内容
* 最终希望向观看者传达的核心信息

忽略以下内容：
* Logo
* 水印
* 品牌角标
* 视频播放器元素
* 背景环境中的文字
* 装饰性元素
* 与视频核心内容无关的视觉细节

不要逐帧描述画面，例如“第一帧……第二帧……第三帧……”。

应综合三帧后直接描述整个视频的核心内容。

不要根据 Logo 或水印推断视频主题。

不要添加无法从三帧合理判断的信息。

## Output

严格输出合法 JSON：

{
"summary": "视频核心内容"
}

只输出 JSON，不输出其他内容。
"""

    return chat_with_vllm('', system_message, image_paths, model="Qwen2.5-VL-7B-Instruct")




if __name__ == '__main__':
    result = ppt_page_diff({
    "relation": "matched",
    "old_page": {
      "page_num": 7,
      "text": "巡检机器人\n挖掘机器人\n爆破装药机器人\n凿岩机器人\n井下作业机器人\n深海挖矿机器人\n「作业海拔」\n4999 m （地上）\n0m （地表）\n-1000m （地下）\n-3000m （海底）\n\n重型装备具身智能\nHeavy-Duty Embodied AI Intelligent Mobility",
      "images": [
        {
          "raw_text": "",
          "summary": "这是一幅描绘峡谷地貌的插画。画面展示了高耸的悬崖峭壁和蜿蜒的河流，表现出一种荒凉而壮丽的自然景观。"
        },
        {
          "raw_text": "",
          "summary": "一张描绘地下隧道和管道的黑白插画。隧道内有管道贯穿，外部有岩石结构和铁轨。"
        },
        {
          "raw_text": "",
          "summary": "这幅图描绘了一个海底场景，有岩石、海草、鱼群和一艘沉船。"
        },
        {
          "raw_text": "",
          "summary": "一张挖掘机的线框图，展示了其机械结构。"
        },
        {
          "raw_text": "",
          "summary": "这是一辆消防车的简笔画。"
        },
        {
          "raw_text": "",
          "summary": "这是一辆带有起重机臂的卡车的示意图。"
        },
        {
          "raw_text": "",
          "summary": "这是一张火星探测车的示意图。"
        },
        {
          "raw_text": "",
          "summary": "一张展示机械臂和履带的机器人图像。"
        },
        {
          "raw_text": "",
          "summary": "一张描绘机械战士的黑白插画。"
        }
      ],
      "videos": []
    },
    "new_page": {
      "page_num": 6,
      "text": "巡检机器人\n挖掘机器人\n爆破装药机器人\n凿岩机器人\n井下作业机器人\n深海挖矿机器人\n「作业海拔」\n5000 m （地上）\n0m （地表）\n-1000m （地下）\n-3000m （海底）\n\n重型装备具身智能\nHeavy-Duty Embodied AI Intelligent Mobility",
      "images": [
        {
          "raw_text": "",
          "summary": "这是一幅描绘峡谷地貌的插画。画面中展示了高耸的悬崖峭壁和蜿蜒曲折的河流，表现出大自然的壮丽景色。"
        },
        {
          "raw_text": "",
          "summary": "一张描绘地下隧道和管道的黑白插画。隧道内有管道穿过，周围有岩石结构和铁轨。"
        },
        {
          "raw_text": "",
          "summary": "这幅图描绘了一个海底场景，有岩石、海草、鱼群、一艘沉船以及一些海洋生物。"
        },
        {
          "raw_text": "",
          "summary": "一张挖掘机的线框图，展示了其机械结构。"
        },
        {
          "raw_text": "",
          "summary": "这是一辆消防车的简笔画。"
        },
        {
          "raw_text": "",
          "summary": "这是一辆带有起重机臂的卡车的示意图。"
        },
        {
          "raw_text": "",
          "summary": "一张描绘火星探测车的黑白线条图。"
        },
        {
          "raw_text": "",
          "summary": "一张描绘了机械臂和履带的机器人图像。"
        },
        {
          "raw_text": "",
          "summary": "一张描绘机械战士的黑白插画。"
        }
      ],
      "videos": []
    },
    "similarity": 0.9466
  })
    print(result)

    # result = json.loads(ppt_image_describer(r"C:\Users\shen.xin\Downloads\0602-143.jpeg"))
    # print(result["raw_text"], '\n\n',result['summary'])

