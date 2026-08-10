import json

from call_qwen import call_qwen_vision


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
只输出 JSON
不使用 Markdown 代码块
不输出任何额外说明
不添加其他字段
确保 JSON 可以被程序直接解析
    """

    return call_qwen_vision('', system_message,[image_path])




if __name__ == '__main__':
    result = json.loads(ppt_image_describer(r"C:\Users\shen.xin\Downloads\0602-143.jpeg"))
    print(result["raw_text"], '\n\n',result['summary'])

