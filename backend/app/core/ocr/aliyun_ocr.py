import httpx
import base64
from .base import BaseOCR


class AliyunOCR(BaseOCR):
    """阿里云OCR"""

    def __init__(self, api_key: str = None, api_secret: str = None):
        self.api_key = api_key
        self.api_secret = api_secret
        self.endpoint = "https://ocr-api.cn-hangzhou.aliyuncs.com"

    @property
    def name(self) -> str:
        return "aliyun"

    def extract_text(self, image_path: str) -> str:
        """调用阿里云OCR识别文字"""
        with open(image_path, "rb") as f:
            img_bytes = f.read()
        img_base64 = base64.b64encode(img_bytes).decode("utf-8")

        payload = {
            "image": img_base64,
            "prob": True,
            "rotate": True,
            "table": False,
        }

        headers = {"Content-Type": "application/json"}

        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                f"{self.endpoint}/api/recognize/text",
                json=payload,
                headers=headers,
                auth=(self.api_key, self.api_secret),
            )
            response.raise_for_status()
            result = response.json()

        texts = []
        for item in result.get("data", {}).get("results", []):
            texts.append(item.get("text", ""))
        return "\n".join(texts)
