import json

from backend.functions.vllm_call import chat_with_vllm
from backend.functions.deepseek_util import deepseek_chat


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

    return chat_with_vllm('', system_message,[image_path], model="Qwen3-VL-8B-Instruct")


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

    return chat_with_vllm('', system_message, image_paths, model="Qwen3-VL-8B-Instruct")


def ppt_page_describer(image_path: str) -> str:
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

    【页面文本】
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

    return chat_with_vllm('', system_message,[image_path], model="Qwen3-VL-8B-Instruct")

def ppt_page_diff_analyzer(old_page_text: str, new_page_text: str) -> str:
    user_message = f"""
页面A:
{old_page_text}

页面B:
{new_page_text}
"""

    # 1. 判断是否为同一页面
    page_match_prompt = """
你是一名 PPT 页面匹配助手。

判断页面A和页面B是否属于同一个页面实体。

判断依据：
- 标题是否一致或高度对应
- 页面主题、业务作用是否一致
- 主体文本和主要内容结构是否对应

注意：
- 局部文字、数字、图片发生变化，不代表是不同页面。
- 只要页面主体身份和内容骨架一致，应判断为 same_page。
- 主题、业务作用或主体内容明显不同，判断为 different_page。
- 忽略空格、换行、标点及轻微识别误差。

只输出 JSON：
{
  "result": "different_page | same_page",
  "reason": "一句话说明依据"
}
"""

    page_result = json.loads(
        chat_with_vllm(
            user_message,
            page_match_prompt,
            model="Qwen3-VL-8B-Instruct"
        )
    )

    if page_result["result"] == "different_page":
        return json.dumps(page_result, ensure_ascii=False)

    # 2. 已确认同一页面，判断版本是否变化
    revision_prompt = """
    你是一名 PPT 页面版本判断助手。

    已确认页面A和页面B属于同一个页面实体。
    现在只判断是否为同一版本。

    结果只能是：
    - same_revision
    - different_revision

    ## 核心规则
    1. 【标题】和【主要文本】必须进行严格内容比对。
        忽略以下差异：
        - 空格
        - 换行
        - 标点
        - 明显的轻微 OCR / 识别误差
    
        除此之外，只要【标题】或【主要文本】存在任何实际文字变化，
        都必须判断为 different_revision，包括：
    
        - 单词或文字修改
        - 同义词替换
        - 措辞调整
        - 内容扩写或缩写
        - 数字、日期、百分比、单位变化
        - 条目新增、删除或修改
    
        **不要因为两段文字语义相似、业务含义接近，就判断为 same_revision。**

    2. 对于【图片文字】，实际文字或数据变化也判断为 different_revision。
    3. 对于【图表/流程/表格】和【视觉元素简述】：
        - 允许自然语言描述方式不同；
        - 只有实际业务内容发生变化时才判断为 different_revision。
        - 只有在核心内容没有实际变化，仅存在格式差异或轻微识别误差时，
        - 才判断为 same_revision。

    只输出 JSON：
    {
      "result": "same_revision | different_revision",
      "reason": "一句话说明最能体现实际变化的依据 | 没有实际差别"
    }
    """

    revision_result = json.loads(
        chat_with_vllm(
            user_message,
            revision_prompt,
            model="Qwen3-VL-8B-Instruct"
        )
    )

    result = (
        "same_page_same_revision"
        if revision_result["result"] == "same_revision"
        else "same_page_different_revision"
    )

    return json.dumps({
        "result": result,
        "reason": revision_result["reason"]
    }, ensure_ascii=False)



if __name__ == '__main__':
    old = """
    【标题】
之前相关经验

【页面文本】
企业级 AIGC Portal / 智能知识库 / AI 内容生成 / 自动化应用

01 企业知识库问答
多部门文档上传、解析、
向量化入库、支持智能检索问答

02 权限控制型 RAG
按小组权限控制
检索范围，确保回答不越权

03 问题改写与检索增强
问题改写、关键词提取、
历史上下文拼接，提升召回质量

04 文档智能解析入库
基于 Azure Doc Intelligence
进行抽取、切片、结构化处理

05 Azure AI Search 检索
向量检索 + 语义检索，
支持知识查询与答案生成

06 AI PPT 自动生成
输入需求后自动生成 PPT
内容、版式与可下载文件

07 缺陷图片 AI 审核
面向商品 / 图片场景的
缺陷识别与审核流程支持

08 自然语言查询数据库
通过自然语言查询数据库，
进行数据分析与结果输出

核心能力：
文档入库 → 权限检索 → 智能问答 → 内容生成 → 自动化应用
相当于为企业搭建了一个可管控、可检索、可生成的 AI 工作平台。

【图片文字】
无

【图表/流程/表格】
中心为“企业级 AI 平台 (AIGC Portal)”，周围环绕8个功能模块（01-08），通过虚线连接。底部为“核心能力”流程图，展示从“文档入库”到“自动化应用”的五个步骤。

【视觉元素简述】
大脑图标、文档图标、锁形图标、对话气泡图标、放大镜图标、PPT图标、图片图标、数据库图标。
    """

    new = """
    【标题】
之前相关经验

【页面文本】
企业级 AI Portal / 智能知识库 / AI 内容生成 / 自动化应用

01 企业知识库问答
多部门文档上传、解析、向量化入库，支持智能检索问答

02 权限控制型 RAG
按用户 / Topic 权限控制检索范围，确保回答不越权

03 问题改写与检索增强
问题改写、关键词提取、历史上下文拼接，提升召回质量

04 文档智能解析入库
基于 Azure Doc Intelligence 进行抽取、切片、结构化处理

05 Azure AI Search 检索
向量检索 + 语义检索，支持知识查询与答案生成

06 AI PPT 自动生成
输入需求后自动生成 PPT 内容、版式与可下载文件

07 缺陷图片 AI 审核
面向商品 / 图片场景的缺陷识别与审核流程支持

08 自然语言查询数据库
通过自然语言查询数据库，进行数据分析与结果输出

核心能力：
文档入库 → 权限检索 → 智能问答 → 内容生成 → 自动化应用
相当于为企业搭建了一个可管控、可检索、可生成的 AI 工作平台。

【图片文字】
无

【图表/流程/表格】
中心为“企业级 AI 平台 (AIGC Portal)”，周围环绕8个功能模块（01-08），通过虚线连接。底部为“核心能力”流程图，展示从“文档入库”到“自动化应用”的五个步骤。

【视觉元素简述】
脑部图标（代表AI）、文档图标、锁形图标、对话气泡图标、放大镜图标、PPT图标、图片图标、数据库图标。
    """
    result = ppt_page_diff_analyzer(old, new)
    print(result)


    # result = ppt_page_describer(r"C:\Users\shen.xin\Desktop\work\local_download_dir\希迪智驾年中报告1\page_13.png")
    # print(result)

