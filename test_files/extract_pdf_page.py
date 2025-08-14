#!/usr/bin/env python3
"""
PDF页面提取工具
提取指定PDF文件的第2页并保存为新的PDF文件
"""

import PyPDF2
import sys
from pathlib import Path

def extract_pdf_page(input_file: str, page_number: int = 2, output_file = None):
    """
    从PDF文件中提取指定页面
    
    Args:
        input_file: 输入PDF文件路径
        page_number: 要提取的页码（从1开始）
        output_file: 输出PDF文件路径，如果不指定则自动生成
    """
    try:
        # 检查输入文件是否存在
        input_path = Path(input_file)
        if not input_path.exists():
            print(f"错误：文件 {input_file} 不存在")
            return False
            
        # 如果没有指定输出文件，自动生成文件名
        if output_file is None:
            output_file = input_path.parent / f"{input_path.stem}_page_{page_number}.pdf"
        
        # 打开输入PDF文件
        with open(input_file, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            
            # 检查页码是否有效
            total_pages = len(pdf_reader.pages)
            print(f"PDF文件总共有 {total_pages} 页")
            
            if page_number < 1 or page_number > total_pages:
                print(f"错误：页码 {page_number} 超出范围 (1-{total_pages})")
                return False
            
            # 创建PDF写入器
            pdf_writer = PyPDF2.PdfWriter()
            
            # 获取指定页面（注意：PyPDF2的页码从0开始）
            page = pdf_reader.pages[page_number - 1]
            pdf_writer.add_page(page)
            
            # 保存提取的页面
            with open(output_file, 'wb') as output:
                pdf_writer.write(output)
            
            print(f"成功提取第 {page_number} 页")
            print(f"输出文件：{output_file}")
            return True
            
    except Exception as e:
        print(f"处理PDF时发生错误：{str(e)}")
        return False

if __name__ == "__main__":
    # 设置输入文件路径
    input_pdf = "demo_files/intern_contract.pdf"
    
    # 提取第2页
    success = extract_pdf_page(input_pdf, page_number=2)
    
    if success:
        print("PDF页面提取完成！")
    else:
        print("PDF页面提取失败！")