import uuid
import os
from dotenv import load_dotenv

load_dotenv()

APP_ID = os.getenv('APP_ID')
APP_SECRET = os.getenv('APP_SECRET')
ENCRYPT_KEY = os.getenv('ENCRYPT_KEY')
VERIFICATION_TOKEN = os.getenv('VERIFICATION_TOKEN')
DOWNLOAD_DIR = os.getenv('DOWNLOAD_DIR')
WIKI_TOKEN = os.getenv('WIKI_TOKEN')
WIKI_SPACE_ID = os.getenv('WIKI_SPACE_ID')
AILY_APP_ID = os.getenv('AILY_APP_ID')
OPENCLAW_WS_URL = os.getenv('OPENCLAW_WS_URL')
OPENCLAW_TOKEN = os.getenv('OPENCLAW_TOKEN')
ALIBABA_CLOUD_ACCESS_KEY_ID = os.getenv('ALIBABA_CLOUD_ACCESS_KEY_ID')
ALIBABA_CLOUD_ACCESS_KEY_SECRET = os.getenv('ALIBABA_CLOUD_ACCESS_KEY_SECRET')
DEEPSEEK_BASE_URL = os.getenv('DEEPSEEK_BASE_URL')
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')
BAILIAN_API_KEY = os.getenv('BAILIAN_API_KEY')

# 本地SQLite数据库文件路径（未配置时默认放在下载目录下）
DB_PATH = os.getenv('DB_PATH') or os.path.join(DOWNLOAD_DIR, 'documents.db')




