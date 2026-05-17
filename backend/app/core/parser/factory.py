import os
from .base import BaseParser
from .pdf_parser import PDFParser
from .docx_parser import DOCXParser


class ParserFactory:
    """解析器工厂"""

    def __init__(self):
        self._parsers: list[BaseParser] = [
            PDFParser(),
            DOCXParser(),
        ]

    def get_parser(self, file_path: str) -> BaseParser:
        """根据文件扩展名获取解析器"""
        ext = os.path.splitext(file_path)[1].lower()
        for parser in self._parsers:
            if ext in parser.supported_extensions:
                return parser
        raise ValueError(f"不支持的文件格式: {ext}")

    def extract_text(self, file_path: str) -> str:
        """自动选择解析器提取文本"""
        parser = self.get_parser(file_path)
        return parser.extract_text(file_path)
