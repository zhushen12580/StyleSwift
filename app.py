# -*- coding: utf-8 -*-
# 导入所需的模块
from flask import Flask, request, jsonify  # Flask框架核心组件
from flask_sqlalchemy import SQLAlchemy  # 数据库ORM
from werkzeug.security import generate_password_hash, check_password_hash  # 密码加密和验证
import os  # 操作系统相关功能
from datetime import datetime  # 日期时间处理
import requests  # HTTP请求
from openai import OpenAI  # OpenAI API客户端
import openai
import uuid
import json
import sqlalchemy

# 创建Flask应用实例
app = Flask(__name__)
# 配置数据库连接
app.config['SQLALCHEMY_DATABASE_URI'] = r'mysql+pymysql://root:Zhushen%4001@39.103.59.43/style_changer_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# 初始化数据库
db = SQLAlchemy(app)

# 定义用户模型
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)  # 主键
    username = db.Column(db.String(50), unique=True, nullable=False)  # 用户名
    language = db.Column(db.String(5))  # 语言偏好
    password_hash = db.Column(db.String(255), nullable=False)  # 密码哈希
    email = db.Column(db.String(255), unique=True, nullable=False)  # 邮箱
    verification_code = db.Column(db.String(20))  # 验证码
    membership_level = db.Column(db.Enum('free', 'premium', 'vip'), default='free')  # 会员等级
    is_active = db.Column(db.Boolean, default=True)  # 是否激活
    premium_expiry_date = db.Column(db.Date)  # 会员到期日期
    registration_date = db.Column(db.DateTime, default=datetime.utcnow)  # 注册日期
    last_login_date = db.Column(db.DateTime)  # 最后登录日期
    created_at = db.Column(db.DateTime, default=datetime.utcnow)  # 创建时间
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # 更新时间

# 定义样式模型
class Style(db.Model):
    __tablename__ = 'styles'
    id = db.Column(db.Integer, primary_key=True)  # 主键
    style_id = db.Column(db.String(100), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)  # 样式名称
    description = db.Column(db.Text)  # 样式描述
    style_url = db.Column(db.String(255))  # 样式URL
    style_code = db.Column(db.Text)  # 样式代码
    style_type = db.Column(db.Enum('default', 'custom-css', 'cute', 'custom', 'modern', 'retro', 'eyecare'), nullable=False)  # 样式类型
    preview_image_url = db.Column(db.String(255))  # 预览图URL
    created_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'))  # 创建者ID
    created_at = db.Column(db.DateTime, default=datetime.utcnow)  # 创建时间
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # 更新时间
    total_ratings = db.Column(db.Integer, default=0)  # 总评分次数
    total_score = db.Column(db.Float, default=0.0)  # 总评分
    average_rating = db.Column(db.Float, default=0.0)  # 平均评分

# 定义用户样式关联模型
class UserStyle(db.Model):
    __tablename__ = 'user_styles'
    id = db.Column(db.Integer, primary_key=True)  # 主键
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'))  # 用户ID
    style_id = db.Column(db.Integer, db.ForeignKey('styles.id', ondelete='CASCADE'))  # 样式ID
    relationship_type = db.Column(db.Enum('created', 'applied', 'shared', 'favorite'), nullable=False)  # 关系类型
    applied_date = db.Column(db.DateTime, default=datetime.utcnow)  # 应用日期

# 定义网站类型模型
class WebsiteType(db.Model):
    __tablename__ = 'website_types'
    id = db.Column(db.Integer, primary_key=True)  # 主键
    name = db.Column(db.String(50), unique=True, nullable=False)  # 类型名称
    description = db.Column(db.Text)  # 类型描述

# 定义样式-网站类型关联模型
class StyleWebsiteType(db.Model):
    __tablename__ = 'style_website_types'
    id = db.Column(db.Integer, primary_key=True)  # 主键
    style_id = db.Column(db.Integer, db.ForeignKey('styles.id', ondelete='CASCADE'))  # 样式ID
    website_type_id = db.Column(db.Integer, db.ForeignKey('website_types.id', ondelete='CASCADE'))  # 网站类型ID

def extract_css_from_response(response_content):
    # 移除可能存在的 <style> 和 </style> 标签
    response_content = response_content.replace('<style>', '').replace('</style>', '')
    
    # 查找 CSS 代码块的开始和结束
    start = response_content.find("```css")
    end = response_content.find("```", start + 1)
    
    if start != -1 and end != -1:
        # 提取 CSS 代码，去除 ```css 和 ``` 标记
        css = response_content[start+6:end].strip()
    else:
        # 如果没有找到标记，假设整个响应都是 CSS
        css = response_content.strip()
    
    return css

# API路由：用户注册
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json  # 获取JSON格式的请求数据
    hashed_password = generate_password_hash(data['password'])  # 对密码进行哈希处理
    new_user = User(username=data['username'], email=data['email'], password_hash=hashed_password)  # 创建新用户对象
    db.session.add(new_user)  # 添加到数据库会话
    db.session.commit()  # 提交更改
    return jsonify({"message": "User registered successfully"}), 201  # 返回成功消息和状态码

# API路由：用户登录
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json  # 获取JSON格式的请求数据
    user = User.query.filter_by(username=data['username']).first()  # 查询用户
    if user and check_password_hash(user.password_hash, data['password']):  # 验证密码
        return jsonify({"message": "Login successful"}), 200  # 登录成功
    return jsonify({"message": "Invalid credentials"}), 401  # 登录失败

# API路由：获取所有样式
@app.route('/api/styles', methods=['GET'])
def get_styles():
    styles = Style.query.all()  # 查询所有样式
    return jsonify([{"id": s.id, "name": s.name, "type": s.style_type} for s in styles])  # 返回样式列表

# API路由：应用样式
@app.route('/api/apply_style', methods=['POST'])
def apply_style():
    data = request.json
    style = Style.query.get(data['style_id'])
    if style:
        return jsonify({"message": "Style applied successfully", "style_code": style.style_code, "style_id": style.style_id}), 200
    return jsonify({"message": "Style not found"}), 404

# API路由：生成AI样式
@app.route('/api/generate_ai_style', methods=['POST'])
def generate_ai_style():
    data = request.json
    page_structure = data.get('pageStructure')
    style = data.get('style')
    custom_description = data.get('customDescription')
    url = data.get('url')
    style_id = data.get('styleId')  # 确保从请求中获取 styleId

    if not style_id:
        return jsonify({"error": "styleId is required"}), 400

    def generate_prompt(style, page_structure, custom_description=None):
        base_prompt = f"""Analyze the following webpage structure and its critical CSS:

        Webpage Structure and Critical CSS:
        {page_structure}

        Based on this structure and existing critical CSS, generate an improved CSS style that:
        1. Builds upon the existing critical CSS, maintaining its core functionality
        2. Enhances the overall visual appeal and user experience
        3. Improves readability and accessibility
        4. Ensures responsive design principles are applied
        5. Optimizes performance by minimizing redundant styles

        Focus on:
        - Color scheme
        - Typography
        - Layout
        - Visual hierarchy
        - Interactions
        - Consistency

        Output only the complete CSS code, including the critical CSS. Do not include any explanations or comments outside the style tags."""

        style_specific_prompts = {
            "modern": "\n\nCreate a modern and sleek style with bold typography, vibrant colors, and smooth transitions.",
            "retro": "\n\nDesign a retro style with vintage color palettes, classic fonts, and nostalgic design elements.",
            "eyecare": "\n\nDevelop an eye-friendly style with soft, muted colors, larger font sizes, and high contrast.",
            "cute": "\n\nCreate a cute and playful style with soft pastel colors, rounded corners, and fun typography.",
            "custom": f"\n\nCreate a custom style based on the following description: {custom_description}"
        }

        prompt = base_prompt + style_specific_prompts.get(style, "\n\nCreate a balanced and professional style suitable for general use.")

        return prompt

    prompt = generate_prompt(style, page_structure, custom_description)

    def generate_ai_style(method='api2'):
        api_key = os.environ.get('DEEPSEEK_API_KEY', "sk-284923071d3f473a8c51dd51c0179f8a")
        
        try:
            if method == 'api1':
                # 调用大模型渠道1方法
                client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")
                
                response = client.chat.completions.create(
                    model="deepseek-coder",
                    messages=[
                        {"role": "system", "content": "You are a skilled web designer. Generate CSS code only, no explanations."},
                        {"role": "user", "content": prompt}
                    ],
                    stream=False,
                    timeout=3000
                )
                
                raw_content = response.choices[0].message.content
                generated_style = extract_css_from_response(raw_content)
                print(generated_style)
            elif method == 'api2':
                # 调用大模型渠道2方法
                baseurl = "https://api.link-ai.tech/v1/chat/completions"
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer Link_tYOZdFTnf0RDsOkryM5gk8lrUkwIBLZDFirsZko8XH"
                }
                body = {
                    "app_code": "",
                    "model": "claude-3-5-sonnet",
                    "messages": [
                        {"role": "system", "content": "You are a skilled web designer. Generate CSS code only, no explanations."},
                        {"role": "user", "content": prompt}
                    ]
                }
                res = requests.post(baseurl, json=body, headers=headers)
                
                if res.status_code == 200:
                    raw_content = res.json().get("choices")[0]['message']['content']
                    generated_style = extract_css_from_response(raw_content)
                    print(generated_style)
                else:
                    error = res.json().get("error")
                    print(f"请求异常, 错误码={res.status_code}, 错误类型={error.get('type')}, 错误信息={error.get('message')}")
                    return jsonify({"message": "Failed to generate AI style", "error": str(error)}), 500
            
            else:
                return jsonify({"message": "Invalid method specified"}), 400

            new_style = Style(
                style_id=style_id,  # 使用从请求中获取的 styleId
                name="AI Generated",
                description=custom_description,
                style_url=url,
                style_code=generated_style,
                style_type=style
            )
            db.session.add(new_style)
            db.session.commit()

            return jsonify({
                "message": "AI style generated and saved successfully",
                "style_code": generated_style,
                "style_id": style_id
            }), 200
        
        except openai.APIError as e:
            app.logger.error(f"OpenAI API error: {str(e)}")
            return jsonify({"message": "Failed to generate AI style", "error": str(e)}), 500
        except Exception as e:
            app.logger.error(f"Unexpected error: {str(e)}", exc_info=True)
            return jsonify({"error": "An unexpected error occurred"}), 500

    return generate_ai_style()

# API路由：提交评分
@app.route('/api/submit_rating', methods=['POST'])
def submit_rating():
    data = request.json
    style_id = data.get('style_id')
    rating = data.get('rating')

    print(f"Received style_id: {style_id}")  # 添加这行

    if not style_id or not rating:
        return jsonify({"message": "Missing style_id or rating"}), 400

    # 使用 filter_by 而不是 get
    style = Style.query.filter_by(style_id=style_id).first()
    
    if not style:
        return jsonify({"message": f"Style not found for id: {style_id}"}), 404

    style.total_ratings += 1
    style.total_score += float(rating)
    style.average_rating = style.total_score / style.total_ratings

    db.session.commit()

    return jsonify({"message": "Rating submitted successfully"}), 200

# API路由：保存自定义CSS
@app.route('/api/save_custom_css', methods=['POST'])
def save_custom_css():
    data = request.json
    css = data.get('css')
    url = data.get('url')
    style_id = data.get('styleId')

    if not css or not style_id or not url:
        return jsonify({"message": "CSS, styleId, and url are required"}), 400

    try:
        new_style = Style(
            style_id=style_id,
            name="Custom CSS",
            style_code=css,
            style_type="custom-css",
            style_url=url
        )
        db.session.add(new_style)
        db.session.commit()
        return jsonify({
            "message": "Custom CSS saved successfully",
            "style_id": style_id
        }), 200
    except sqlalchemy.exc.IntegrityError as e:
        db.session.rollback()
        return jsonify({"message": "Style ID already exists"}), 409
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error saving CSS: {str(e)}")
        return jsonify({"message": "Internal server error"}), 500

@app.route('/')
def index():
    return "Hello, World!"

# 主程序入口
if __name__ == '__main__':
    app.run()
