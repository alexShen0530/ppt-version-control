import time
import uuid

import lark_oapi as lark
from lark_oapi.api.aily.v1 import (
    CreateAilySessionAilyMessageRequest,
    CreateAilySessionAilyMessageRequestBody,
    CreateAilySessionRequest,
    CreateAilySessionRequestBody,
    CreateAilySessionRunRequest,
    CreateAilySessionRunRequestBody,
    GetAilySessionRunRequest,
    ListAilySessionAilyMessageRequest,
)

import config


client = (
    lark.Client.builder()
    .app_id(config.APP_ID)
    .app_secret(config.APP_SECRET)
    .log_level(lark.LogLevel.INFO)
    .build()
)


def _check_response(response, action):
    if not response.success():
        raise RuntimeError(
            f"{action}失败: code={response.code}, msg={response.msg}, "
            f"log_id={response.get_log_id()}"
        )


def chat_with_aily(user_message: str, timeout: int = 60) -> str:
    """向 Aily 应用发送一条消息，并等待智能体返回最终答案。"""
    if not config.AILY_APP_ID:
        raise ValueError("缺少环境变量 AILY_APP_ID（格式为 spring_xxx__c）")

    session_request = (
        CreateAilySessionRequest.builder()
        .request_body(CreateAilySessionRequestBody.builder().build())
        .build()
    )
    session_response = client.aily.v1.aily_session.create(session_request)
    _check_response(session_response, "创建 Aily 会话")
    session_id = session_response.data.session.id

    message_request = (
        CreateAilySessionAilyMessageRequest.builder()
        .aily_session_id(session_id)
        .request_body(
            CreateAilySessionAilyMessageRequestBody.builder()
            .idempotent_id(str(uuid.uuid4()))
            .content_type("MDX")
            .content(user_message)
            .build()
        )
        .build()
    )
    message_response = client.aily.v1.aily_session_aily_message.create(
        message_request
    )
    _check_response(message_response, "发送用户消息")

    run_request = (
        CreateAilySessionRunRequest.builder()
        .aily_session_id(session_id)
        .request_body(
            CreateAilySessionRunRequestBody.builder()
            .app_id(config.AILY_APP_ID)
            .build()
        )
        .build()
    )
    run_response = client.aily.v1.aily_session_run.create(run_request)
    _check_response(run_response, "创建 Aily Run")
    run_id = run_response.data.run.id

    deadline = time.time() + timeout
    while time.time() < deadline:
        run_status_request = (
            GetAilySessionRunRequest.builder()
            .aily_session_id(session_id)
            .run_id(run_id)
            .build()
        )
        run_status_response = client.aily.v1.aily_session_run.get(
            run_status_request
        )
        _check_response(run_status_response, "查询 Aily Run")

        run = run_status_response.data.run
        status = (run.status or "").upper()
        if status in {"FAILED", "CANCELLED", "EXPIRED"}:
            error = run.error
            detail = error.message if error else status
            raise RuntimeError(f"Aily Run 执行失败: {detail}")

        if status in {"COMPLETED", "SUCCESS", "SUCCEEDED"}:
            messages_request = (
                ListAilySessionAilyMessageRequest.builder()
                .aily_session_id(session_id)
                .run_id(run_id)
                .page_size(20)
                .build()
            )
            messages_response = client.aily.v1.aily_session_aily_message.list(
                messages_request
            )
            _check_response(messages_response, "获取 Aily 回答")

            for message in reversed(messages_response.data.messages or []):
                sender_type = (
                    message.sender.sender_type if message.sender else ""
                )
                if sender_type.upper() in {"ASSISTANT", "AI", "AILY"}:
                    return message.plain_text or message.content or ""

            raise RuntimeError("Aily Run 已完成，但没有找到智能体回答")

        time.sleep(2)

    raise TimeoutError(f"等待 Aily 回答超过 {timeout} 秒")


if __name__ == "__main__":
    question = "你好，介绍一下你自己"
    print(f"问题: {question}")
    print(f"回答: {chat_with_aily(question)}")
