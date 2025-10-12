#!/usr/bin/env python3
"""
Kokoro TTS Text Chunking Module
智能文本分块模块，用于将长文本分割为适合 TTS 合成的小块
"""

import re
from typing import List

# Kokoro phoneme 限制，保持 chunk 大小较小
MAX_CHUNK_CHAR_SIZE = 100


def _chunk_by_tokens(text: str, max_chunk_size: int) -> List[str]:
    """
    按单词边界强制切分，尽量避免拆词。
    """
    tokens = re.findall(r'\S+\s*', text)
    chunks: List[str] = []
    current_chunk = ""

    for token in tokens:
        prospective = current_chunk + token
        if len(prospective) <= max_chunk_size:
            current_chunk = prospective
        else:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
                current_chunk = token
            elif len(token) <= max_chunk_size:
                current_chunk = token
            else:
                # 无法保持单词完整，退回字符级切分
                for i in range(0, len(token), max_chunk_size):
                    part = token[i:i + max_chunk_size]
                    chunks.append(part.strip())
                current_chunk = ""

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks


def split_text_intelligently(text: str, max_chunk_size: int = MAX_CHUNK_CHAR_SIZE) -> List[str]:
    """
    智能分割文本，优先在句子边界分割

    Args:
        text: 待分割的文本
        max_chunk_size: 每个 chunk 的最大字符数

    Returns:
        分割后的文本块列表
    """
    chunks: List[str] = []

    # 先按段落分割
    paragraphs: List[str] = text.split('\n\n')
    current_chunk: str = ""

    for paragraph in paragraphs:
        # 如果当前块加上新段落不会太长，就添加
        if len(current_chunk + paragraph) <= max_chunk_size:
            current_chunk += paragraph + "\n\n"
        else:
            # 如果当前块不为空，先保存
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
                current_chunk = ""

            # 如果单个段落太长，需要进一步分割
            if len(paragraph) > max_chunk_size:
                sentences = split_by_sentences(paragraph, max_chunk_size)
                chunks.extend(sentences)
            else:
                current_chunk = paragraph + "\n\n"

    # 添加最后一个块
    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks


def split_by_sentences(text: str, max_chunk_size: int = MAX_CHUNK_CHAR_SIZE) -> List[str]:
    """
    按句子分割文本

    Args:
        text: 待分割的文本
        max_chunk_size: 每个 chunk 的最大字符数

    Returns:
        分割后的文本块列表
    """
    # 按句子分割（句号、问号、感叹号）
    sentences: List[str] = re.split(r'(?<=[.!?])\s+', text)
    chunks: List[str] = []
    current_chunk: str = ""

    for sentence in sentences:
        if len(current_chunk + sentence) <= max_chunk_size:
            current_chunk += sentence + " "
        else:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
                current_chunk = ""

            # 如果单个句子太长，按逗号分割
            if len(sentence) > max_chunk_size:
                sub_chunks = split_by_commas(sentence, max_chunk_size)
                chunks.extend(sub_chunks)
            else:
                current_chunk = sentence + " "

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks


def split_by_commas(text: str, max_chunk_size: int = MAX_CHUNK_CHAR_SIZE) -> List[str]:
    """
    按逗号分割文本

    Args:
        text: 待分割的文本
        max_chunk_size: 每个 chunk 的最大字符数

    Returns:
        分割后的文本块列表
    """
    parts: List[str] = text.split(', ')
    chunks: List[str] = []
    current_chunk: str = ""

    for part in parts:
        segment = part + ", " if part != parts[-1] else part
        prospective = current_chunk + segment
        if len(prospective) <= max_chunk_size:
            current_chunk = prospective
        else:
            if current_chunk.strip():
                chunks.append(current_chunk.rstrip(', '))
                current_chunk = ""

            if len(segment) > max_chunk_size:
                word_chunks: List[str] = _chunk_by_tokens(segment, max_chunk_size)
                if not word_chunks:
                    continue
                for chunk_part in word_chunks[:-1]:
                    chunks.append(chunk_part.rstrip(', '))
                current_chunk = word_chunks[-1]
            else:
                current_chunk = segment

    if current_chunk.strip():
        chunks.append(current_chunk.rstrip(', '))

    normalized: List[str] = []
    for chunk in chunks:
        if len(chunk) > max_chunk_size:
            normalized.extend(_chunk_by_tokens(chunk, max_chunk_size))
        else:
            normalized.append(chunk)

    return [c for c in normalized if c]
