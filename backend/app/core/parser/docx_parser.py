import docx
from .base import BaseParser


class DOCXParser(BaseParser):
    """Word解析器"""

    @property
    def supported_extensions(self) -> list[str]:
        return [".docx"]

    def extract_text(self, file_path: str) -> str:
        """提取Word文本"""
        document = docx.Document(file_path)
        paragraphs = [p.text for p in document.paragraphs if p.text.strip()]
        return "\n".join(paragraphs)
