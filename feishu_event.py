from concurrent.futures import ThreadPoolExecutor
from threading import Lock

from lark_oapi.ws import Client
from lark_oapi.event.dispatcher_handler import EventDispatcherHandler
import config
import json
from db_store import document_store


class FeishuEventListener:
    """飞书事件监听器（长连接模式）"""

    def __init__(self, on_message_callback):
        """
        初始化
        :param on_message_callback: 收到消息时的回调函数
        """
        self.on_message_callback = on_message_callback
        self.processed_message_ids = set()
        self.processed_message_lock = Lock()
        self.task_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="ppt-worker")

        # 1. 构建事件处理器
        event_handler = EventDispatcherHandler.builder(
            config.ENCRYPT_KEY,
            config.VERIFICATION_TOKEN
        ).register_p2_im_message_receive_v1(
            self._handle_message  # 注册消息接收事件
        ).build()

        # 2. 创建长连接客户端
        self.client = Client(
            app_id=config.APP_ID,
            app_secret=config.APP_SECRET,
            event_handler=event_handler
        )

    def _handle_message(self, data):
        """处理收到的消息事件"""
        try:
            # 提取消息基本信息（注意：在data.event下面）
            event = data.event
            message = event.message
            chat_id = message.chat_id
            msg_type = message.message_type
            message_id = message.message_id
            sender_id = event.sender.sender_id.open_id

            with self.processed_message_lock:
                if message_id in self.processed_message_ids:
                    print(f"🔄 重复消息，跳过: {message_id}")
                    return
                if document_store.is_message_processed(message_id):
                    print(f"🔄 消息已成功处理过，跳过: {message_id}")
                    return
                self.processed_message_ids.add(message_id)
                if len(self.processed_message_ids) > 1000:
                    self.processed_message_ids = set(list(self.processed_message_ids)[-500:])

            print(f"\n📨 收到新消息 | 类型: {msg_type} | 群ID: {chat_id}")

            # 构造消息数据传给回调
            msg_data = {
                "message_id": message_id,
                "chat_id": chat_id,
                "msg_type": msg_type,
                "sender_id": sender_id,
                "content": message.content  # JSON字符串
            }

            # 投递后台任务后立即返回，避免阻塞长连接心跳
            self.task_executor.submit(self._process_message, msg_data)

        except Exception as e:
            print(f"❌ 处理消息出错: {e}")
            import traceback
            traceback.print_exc()

    def _process_message(self, msg_data):
        try:
            self.on_message_callback(msg_data)
        except Exception as e:
            with self.processed_message_lock:
                self.processed_message_ids.discard(msg_data["message_id"])
            print(f"❌ 后台处理消息失败: {e}")
            import traceback
            traceback.print_exc()

    def start(self):
        """启动监听"""
        print("🚀 长连接启动中...")
        print("📢 去群里发个消息试试吧！")
        self.client.start()