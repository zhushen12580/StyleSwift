# -*- coding: utf-8 -*-
# 导入所需的模块
from flask import Flask, request, jsonify, url_for, render_template_string,render_template # Flask框架核心组件
from flask_sqlalchemy import SQLAlchemy  # 数据库ORM
from werkzeug.security import generate_password_hash, check_password_hash  # 密码加密和验证
import os  # 操作系统相关功能
from datetime import datetime, timedelta, timezone # 日期时间处理
import requests  # HTTP请求
from openai import OpenAI  # OpenAI API客户端
import openai
import uuid
import json
import sqlalchemy
import time
import re
from urllib.parse import urlparse, urljoin # For creating absolute URLs
from flask_mail import Mail, Message  # Import Flask-Mail
import secrets                          # For generating secure tokens
from dotenv import load_dotenv # Import python-dotenv

# Load environment variables from .env file
load_dotenv()

# 北京时间工具函数
def get_beijing_time():
    """获取北京时间"""
    beijing_tz = timezone(timedelta(hours=8))
    return datetime.now(beijing_tz)

def format_beijing_time(dt=None):
    """格式化北京时间"""
    if dt is None:
        dt = get_beijing_time()
    elif dt.tzinfo is None:
        # 如果是UTC时间，转换为北京时间
        beijing_tz = timezone(timedelta(hours=8))
        dt = dt.replace(tzinfo=timezone.utc).astimezone(beijing_tz)
    return dt.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3] + ' CST'

def calculate_duration(start_time, end_time=None):
    """计算耗时（秒）"""
    if end_time is None:
        end_time = get_beijing_time()
    if start_time.tzinfo is None:
        beijing_tz = timezone(timedelta(hours=8))
        start_time = start_time.replace(tzinfo=beijing_tz)
    if end_time.tzinfo is None:
        beijing_tz = timezone(timedelta(hours=8))
        end_time = end_time.replace(tzinfo=beijing_tz)
    return (end_time - start_time).total_seconds()

# 创建Flask应用实例
app = Flask(__name__)

# --- Backend Translations --- #
translations = {
    'en': {
        # API Messages
        'email_required': 'Email is required.',
        'invalid_email': 'Invalid email format.',
        'already_verified': 'This email is already on the verified waitlist.',
        'verification_resent': 'Verification email resent. Please check your inbox (and spam folder).',
        'fail_resend': 'Failed to resend verification email. Please try again later.',
        'check_email_verify': 'You\'ve already signed up. Please check your email (and spam folder) for the verification link.',
        'verification_sent': 'Verification email sent! Please check your inbox (and spam folder) to complete signup.',
        'fail_send': 'Signup recorded, but failed to send verification email. Please contact support or try again later.',
        'email_exists_error': 'An error occurred. This email might already exist.',
        'internal_error': 'An internal error occurred. Please try again later.',
        # Email Subject (Body is now in template)
        'email_subject': 'Verify your email for StyleSwift Waitlist',
        # Verification Page
        'verify_fail_invalid': '<h1>Verification Failed</h1><p>This verification link is invalid.</p>',
        'verify_already': '<h1>Already Verified</h1><p>Your email address has already been verified.</p>',
        'verify_fail_expired': '<h1>Link Expired</h1><p>This verification link has expired. Please sign up again to receive a new link.</p>',
        'verify_success': '<h1>Verification Successful!</h1><p>Thank you for verifying your email. We\'ll keep you updated!</p>',
        'verify_fail_error': '<h1>Verification Failed</h1><p>An error occurred during verification. Please try again later or contact support.</p>',
    },
    'zh': {
        # API Messages
        'email_required': '需要提供电子邮件地址。',
        'invalid_email': '无效的电子邮件格式。',
        'already_verified': '该电子邮件已在验证的候补名单上。',
        'verification_resent': '验证邮件已重新发送。请检查您的收件箱（和垃圾邮件文件夹）。',
        'fail_resend': '重新发送验证邮件失败。请稍后再试。',
        'check_email_verify': '您已注册。请检查您的电子邮件（和垃圾邮件文件夹）以获取验证链接。',
        'verification_sent': '验证邮件已发送！请检查您的收件箱（和垃圾邮件文件夹）以完成注册。',
        'fail_send': '注册已记录，但发送验证邮件失败。请联系支持或稍后再试。',
        'email_exists_error': '发生错误。该电子邮件可能已存在。',
        'internal_error': '发生内部错误。请稍后再试。',
        # Email Subject (Body is now in template)
        'email_subject': '验证您的 数字女娲 候补名单邮箱',
        # Verification Page
        'verify_fail_invalid': '<h1>验证失败</h1><p>此验证链接无效。</p>',
        'verify_already': '<h1>已验证</h1><p>您的电子邮件地址已被验证。</p>',
        'verify_fail_expired': '<h1>链接已过期</h1><p>此验证链接已过期。请重新注册以获取新链接。</p>',
        'verify_success': '<h1>验证成功！</h1><p>感谢您验证电子邮件。我们会及时通知您最新消息！</p>',
        'verify_fail_error': '<h1>验证失败</h1><p>验证过程中发生错误。请稍后重试或联系支持。</p>',
    }
}
# --- End Backend Translations --- #

# --- Configuration from Environment Variables --- #

# 配置数据库连接
# IMPORTANT: Ensure SQLALCHEMY_DATABASE_URI is set in your .env file or environment
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('SQLALCHEMY_DATABASE_URI')
if not app.config['SQLALCHEMY_DATABASE_URI']:
    raise ValueError("No SQLALCHEMY_DATABASE_URI set for Flask application")

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_size': 10,
    'pool_timeout': 30,
    'pool_recycle': 1800,  # 30分钟
    'connect_args': {
        'connect_timeout': 60,  # 连接超时时间
    }
}

# 配置 Flask-Mail (Reads from .env or environment)
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587)) # Default port if not set
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'False').lower() == 'true'
app.config['MAIL_USE_SSL'] = os.environ.get('MAIL_USE_SSL', 'False').lower() == 'true'
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER')
app.config['MAIL_MAX_EMAILS'] = None

# Server Name for URL Generation
app.config['SERVER_NAME'] = os.environ.get('SERVER_NAME')
app.config['APPLICATION_ROOT'] = '/'
app.config['PREFERRED_URL_SCHEME'] = 'https' if app.config.get('SERVER_NAME') and not app.config['SERVER_NAME'].startswith('localhost') else 'http'

# Optional: Flask Secret Key (Good practice)
# app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')
# if not app.config['SECRET_KEY']:
#    print("Warning: SECRET_KEY is not set. Using a default value for development.")
#    app.config['SECRET_KEY'] = 'dev-secret-key' # Only for development!

# --- End Configuration --- #

# 初始化数据库
db = SQLAlchemy(app)

# 初始化 Flask-Mail
mail = Mail(app)

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
    website_type_id = db.Column(db.Integer, db.ForeignKey('website_types.id', ondelete='CASCADE'))  # 网站类型ID

# 定义等待列表模型
class WaitlistEntry(db.Model):
    __tablename__ = 'waitlist_entries'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    verification_token = db.Column(db.String(100), unique=True, nullable=False)
    token_expiry = db.Column(db.DateTime, nullable=False)
    is_verified = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    verified_at = db.Column(db.DateTime, nullable=True) # Optional: record verification time

    def set_token(self, expiry_seconds=86400): # Default expiry: 24 hours
        self.verification_token = secrets.token_urlsafe(32)
        self.token_expiry = datetime.utcnow() + timedelta(seconds=expiry_seconds)

    def check_token(self, token):
        return secrets.compare_digest(self.verification_token, token) and \
               self.token_expiry > datetime.utcnow()



# 发送验证邮件 (Modified for HTML Template)
def send_verification_email(recipient_email, token, language='en'): # Add language parameter
    """Sends the verification email using an HTML template."""
    app.logger.info(f"Attempting to send verification email to {recipient_email} in language: {language}")
    try:
        with app.app_context(): # Ensure context for url_for
            verify_url = url_for('verify_email', token=token, _external=True, _scheme=app.config['PREFERRED_URL_SCHEME'])
            # Generate absolute URL for the logo
            logo_url = url_for('static', filename='pic/icon48.svg', _external=True, _scheme=app.config['PREFERRED_URL_SCHEME'])
            app.logger.info(f"Generated verification URL: {verify_url}")
            app.logger.info(f"Generated logo URL: {logo_url}")

        # Get translations for the specified language, fallback to 'en'
        lang_translations = translations.get(language, translations['en'])
        # Get brand name based on language
        brand_name = "数字女娲" if language == 'zh' else "StyleSwift"

        subject = lang_translations['email_subject'] # Get subject from translations dict
        sender = app.config['MAIL_DEFAULT_SENDER']

        # Render the HTML template
        html_body = render_template(
            'emails/verification_email.html', # Path to the new template
            subject=subject,
            language=language,
            brand_name=brand_name,
            verify_url=verify_url,
            logo_url=logo_url,
            current_year=datetime.utcnow().year
        )

        msg = Message(subject, sender=sender, recipients=[recipient_email], html=html_body)

        try:
            app.logger.info(f"Sending email via Flask-Mail to {recipient_email}...")
            mail.send(msg)
            app.logger.info(f"Verification email successfully sent to {recipient_email} in {language}")
            return True
        except Exception as e:
            app.logger.error(f"Flask-Mail failed to send email to {recipient_email}: {str(e)}", exc_info=True)
            return False

    except RuntimeError as e:
         app.logger.error(f"Could not generate URLs or render template. Is the request/app context available? Error: {e}", exc_info=True)
         return False
    except KeyError as e:
        app.logger.error(f"Translation key missing for language '{language}': {e}", exc_info=True)
        return False
    except Exception as e:
        app.logger.error(f"An unexpected error occurred generating the verification URL or email content: {e}", exc_info=True)
        return False

# 加入等待列表路由 (Modified)
@app.route('/api/join_waitlist', methods=['POST'])
def join_waitlist():
    data = request.json
    email = data.get('email')
    # Get language from request, default to 'en'
    language = data.get('language', 'en')
    # Ensure language is supported, fallback to 'en' if not
    if language not in translations:
        language = 'en'

    # Get translations for the determined language
    t = translations[language]

    app.logger.info(f"Received waitlist signup request for email: {email} with language: {language}")

    if not email:
        app.logger.warning("Waitlist signup failed: Email is required.")
        return jsonify({"success": False, "message": t['email_required']}), 400

    # Basic email format check (you might want a more robust check)
    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
         app.logger.warning(f"Waitlist signup failed: Invalid email format for {email}")
         return jsonify({"success": False, "message": t['invalid_email']}), 400

    app.logger.info(f"Checking existing waitlist entries for {email}")
    existing_entry = WaitlistEntry.query.filter_by(email=email).first()

    if existing_entry:
        app.logger.info(f"Found existing entry for {email}. Verified status: {existing_entry.is_verified}")
        if existing_entry.is_verified:
            # Already verified
            app.logger.info(f"Email {email} already verified.")
            return jsonify({"success": True, "message": t['already_verified']}), 200
        else:
            # Exists but not verified, resend email if token expired or just notify
            if existing_entry.token_expiry < datetime.utcnow():
                app.logger.info(f"Verification token for {email} expired. Generating new token and resending email in {language}.")
                # Token expired, generate new one and resend
                existing_entry.set_token()
                db.session.commit()
                app.logger.info(f"Attempting to resend verification email to {email} in {language}")
                email_sent = send_verification_email(email, existing_entry.verification_token, language)
                if email_sent:
                    app.logger.info(f"Resent verification email successfully to {email} in {language}")
                    return jsonify({"success": True, "message": t['verification_resent']}), 200
                else:
                    app.logger.error(f"Failed to resend verification email to {email} in {language}")
                    return jsonify({"success": False, "message": t['fail_resend']}), 500
            else:
                app.logger.info(f"Verification token for {email} still valid. Reminding user to check email.")
                # Token still valid, just remind them
                return jsonify({"success": True, "message": t['check_email_verify']}), 200
    else:
        app.logger.info(f"No existing entry found for {email}. Creating new waitlist entry.")
        # New entry
        new_entry = WaitlistEntry(email=email)
        new_entry.set_token() # Generate token and expiry
        db.session.add(new_entry)
        try:
            app.logger.info(f"Attempting to commit new waitlist entry for {email} to DB.")
            db.session.commit()
            app.logger.info(f"New waitlist entry for {email} committed successfully. Attempting to send verification email in {language}.")
            email_sent = send_verification_email(email, new_entry.verification_token, language)
            if email_sent:
                 app.logger.info(f"Initial verification email sent successfully to {email} in {language}")
                 return jsonify({"success": True, "message": t['verification_sent']}), 201
            else:
                 app.logger.error(f"Failed to send initial verification email to {email} after DB commit in {language}.")
                 return jsonify({"success": False, "message": t['fail_send']}), 500
        except sqlalchemy.exc.IntegrityError as e:
             db.session.rollback()
             app.logger.error(f"Database integrity error adding waitlist entry for {email}: {e}", exc_info=True)
             return jsonify({"success": False, "message": t['email_exists_error']}), 409
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error adding waitlist entry for {email}: {e}", exc_info=True)
            return jsonify({"success": False, "message": t['internal_error']}), 500

# 验证邮箱路由 (Modified)
@app.route('/verify_email/<token>', methods=['GET'])
def verify_email(token):
    # Determine language from request header (Accept-Language) or default to 'en'
    # This is a simple implementation, a more robust one might parse quality values
    accept_language = request.headers.get('Accept-Language')
    language = 'en' # Default
    if accept_language:
        preferred_langs = [lang.split(';')[0].strip().lower() for lang in accept_language.split(',')]
        if 'zh' in preferred_langs or 'zh-cn' in preferred_langs:
            language = 'zh'
        # Add more language checks if needed
    
    # Get translations for the determined language
    t = translations.get(language, translations['en'])

    app.logger.info(f"Received verification request with token: {token[:10]}... using language: {language}")
    entry = WaitlistEntry.query.filter_by(verification_token=token).first()

    if not entry:
        app.logger.warning(f"Verification failed: Token not found - {token[:10]}...")
        return render_template_string(t['verify_fail_invalid']), 404

    app.logger.info(f"Found waitlist entry for email {entry.email} associated with token {token[:10]}...")

    if entry.is_verified:
        app.logger.info(f"Email {entry.email} is already verified.")
        return render_template_string(t['verify_already']), 200

    if entry.token_expiry < datetime.utcnow():
        app.logger.warning(f"Verification failed for {entry.email}: Token expired at {entry.token_expiry}.")
        return render_template_string(t['verify_fail_expired']), 410 # 410 Gone

    # Verification successful
    app.logger.info(f"Verification successful for {entry.email}. Updating status in DB.")
    entry.is_verified = True
    entry.verified_at = datetime.utcnow()
    try:
        db.session.commit()
        app.logger.info(f"Successfully updated verification status for {entry.email} in DB.")
        return render_template_string(t['verify_success']), 200
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error committing verification status for {entry.email}: {e}", exc_info=True)
        return render_template_string(t['verify_fail_error']), 500


# 主页路由
@app.route('/')
def index():
    return render_template('langding-page.html')

# 创建数据库表（如果它们还不存在）
# 注意：在生产环境中，通常使用数据库迁移工具（如Flask-Migrate）来管理模式更改
with app.app_context():
    db.create_all()

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
    """从AI响应中提取并格式化CSS代码"""
    # 移除可能存在的 <style> 和 </style> 标签
    response_content = response_content.replace('<style>', '').replace('</style>', '')
    
    # 查找 CSS 代码块
    start = response_content.find("```css")
    if start == -1:
        start = response_content.find("```")
    
    if start != -1:
        start = response_content.find("\n", start) + 1
        end = response_content.find("```", start)
        if end != -1:
            css = response_content[start:end].strip()
        else:
            css = response_content[start:].strip()
    else:
        css = response_content.strip()
    
    # 清理和格式化 CSS
    css = css.replace('\n\n', '\n').strip()
    
    # 移除重复的选择器
    css = re.sub(r'([^{]+)\s*{\s*\1\s*{', r'\1 {', css)
    
    # 确保大括号配对
    open_braces = css.count('{')
    close_braces = css.count('}')
    if open_braces > close_braces:
        css += '}' * (open_braces - close_braces)
    
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
    request_start_time = get_beijing_time()
    app.logger.info(f"=== 站点模式样式生成请求开始 ===")
    app.logger.info(f"请求时间: {format_beijing_time(request_start_time)}")
    app.logger.info(f"请求来源: {request.remote_addr}")
    
    data = request.json
    page_structure = data.get('pageStructure')
    style = data.get('style')
    custom_description = data.get('customDescription')
    url = data.get('url')
    style_id = data.get('styleId')  # 从请求中获取 style_id
    existing_style = data.get('existingStyle')
    
    app.logger.info(f"请求参数 - URL: {url}")
    app.logger.info(f"请求参数 - 样式类型: {style}")
    app.logger.info(f"请求参数 - 样式ID: {style_id}")
    app.logger.info(f"请求参数 - 自定义描述: {custom_description}")
    app.logger.info(f"页面结构长度: {len(page_structure) if page_structure else 0} 字符")

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


    try:
        # 生成提示
        app.logger.info("开始生成AI提示词...")
        prompt = generate_prompt(style, page_structure, custom_description)
        app.logger.info(f"提示词生成完成，长度: {len(prompt)} 字符")
        
        # 生成样式
        ai_request_start = get_beijing_time()
        app.logger.info(f"开始调用AI服务生成样式 - {format_beijing_time(ai_request_start)}")
        generated_style = generate_ai_style_with_retry(prompt)
        ai_request_end = get_beijing_time()
        ai_duration = calculate_duration(ai_request_start, ai_request_end)
        app.logger.info(f"AI服务调用完成 - 耗时: {ai_duration:.3f}秒")
        app.logger.info(f"生成的样式长度: {len(generated_style)} 字符")
        
        # 根据style_id更新或创建数据库记录
        db_operation_start = get_beijing_time()
        app.logger.info("开始数据库操作...")
        
        style_record = Style.query.filter_by(style_id=style_id).first()
        if style_record:
            app.logger.info(f"找到现有样式记录，ID: {style_id}")
            if existing_style:
                app.logger.info("合并新样式和现有样式...")
                # 合并新样式和现有样式
                final_style = merge_styles(existing_style['style_code'], generated_style)
                app.logger.info(f"样式合并完成，最终样式长度: {len(final_style)} 字符")
            else:
                final_style = generated_style
                app.logger.info("使用新生成的样式")
                
            style_record.style_code = final_style
            style_record.updated_at = get_beijing_time()
            app.logger.info(f"更新现有样式记录完成，ID: {style_id}")
        else:
            app.logger.info(f"创建新样式记录，ID: {style_id}")
            # 创建新记录使用传入的style_id
            style_record = Style(
                style_id=style_id,
                name=f"Style for {url}",
                description=custom_description or f"Generated style for {url}",
                style_url=url,
                style_code=generated_style,
                style_type=style,
                created_at=get_beijing_time()
            )
            db.session.add(style_record)
            app.logger.info(f"新样式记录已添加到会话，ID: {style_id}")
            final_style = generated_style

        # 添加重试机制
        max_retries = 3
        app.logger.info("开始提交数据库事务...")
        for attempt in range(max_retries):
            try:
                db.session.commit()
                db_operation_end = get_beijing_time()
                db_duration = calculate_duration(db_operation_start, db_operation_end)
                app.logger.info(f"数据库事务提交成功 - 耗时: {db_duration:.3f}秒")
                break
            except sqlalchemy.exc.OperationalError as e:
                app.logger.warning(f"数据库操作重试 {attempt + 1}/{max_retries}: {str(e)}")
                if attempt == max_retries - 1:
                    app.logger.error(f"数据库操作最终失败: {str(e)}")
                    raise
                db.session.rollback()
                db.session.remove()
                time.sleep(1)

        request_end_time = get_beijing_time()
        total_duration = calculate_duration(request_start_time, request_end_time)
        app.logger.info(f"=== 站点模式样式生成请求完成 ===")
        app.logger.info(f"总耗时: {total_duration:.3f}秒")
        app.logger.info(f"返回样式ID: {style_id}")
        app.logger.info(f"返回样式长度: {len(final_style)} 字符")

        return jsonify({
            "message": "AI style generated and saved successfully",
            "style_code": final_style,
            "style_id": style_id
        }), 200

    except Exception as e:
        db.session.rollback()
        request_end_time = get_beijing_time()
        total_duration = calculate_duration(request_start_time, request_end_time)
        app.logger.error(f"=== 站点模式样式生成请求失败 ===")
        app.logger.error(f"失败时间: {format_beijing_time(request_end_time)}")
        app.logger.error(f"总耗时: {total_duration:.3f}秒")
        app.logger.error(f"错误详情: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500

def generate_ai_style_with_retry(prompt, max_retries=3):
    """使用重试机制生成AI样式"""
    app.logger.info(f"开始AI样式生成 - 最大重试次数: {max_retries}")
    
    for attempt in range(max_retries):
        app.logger.info(f"AI调用尝试 {attempt + 1}/{max_retries}")
        try:
            # 首先尝试API1 (Deepseek)
            try:
                app.logger.info("尝试使用 DeepSeek API...")
                # 如果API1失败,尝试API2 (Claude)
                api_key = os.environ.get('DEEPSEEK_API_KEY', "sk-a76edfa9a4fa4bab8a25eb030738e14d")
                client = OpenAI(
                    api_key=api_key,
                    base_url="https://api.deepseek.com"
                )
                app.logger.info("DeepSeek 客户端初始化完成")
                
                deepseek_start = get_beijing_time()
                app.logger.info(f"开始调用 DeepSeek API - {format_beijing_time(deepseek_start)}")
                
                response = client.chat.completions.create(
                    model="deepseek-chat",
                    messages=[
                        {"role": "system", "content": "You are a skilled web designer. Generate CSS code only, no explanations."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.7,
                    max_tokens=2000,
                    stream=False,
                    timeout=50 # Increased timeout
                )
                
                deepseek_end = get_beijing_time()
                deepseek_duration = calculate_duration(deepseek_start, deepseek_end)
                app.logger.info(f"DeepSeek API 调用成功 - 耗时: {deepseek_duration:.3f}秒")
                
                raw_content = response.choices[0].message.content
                app.logger.info(f"DeepSeek 返回内容长度: {len(raw_content)} 字符")
                app.logger.debug(f"DeepSeek 原始返回内容: {raw_content[:200]}...")
                
                extracted_css = extract_css_from_response(raw_content)
                app.logger.info(f"CSS 提取完成，长度: {len(extracted_css)} 字符")
                return extracted_css
            except Exception as e:
                app.logger.warning(f"DeepSeek API (API1) failed on attempt {attempt + 1}/{max_retries}, trying Claude API (API2). Error: {str(e)}")
                app.logger.debug(f"DeepSeek API error details: {repr(e)}", exc_info=True)
                
                app.logger.info("切换到 Claude API...")
                baseurl = "https://api.link-ai.tech/v1/chat/completions"
                headers = {
                    "Content-Type": "application/json",
                    "Accept": "application/json", # Added Accept header
                    "Authorization": "Bearer Link_tYOZdFTnf0RDsOkryM5gk8lrUkwIBLZDFirsZko8XH"
                }
                body = {
                    "app_code": "", # Added app_code
                    "model": "claude-3-5-sonnet",
                    "messages": [
                        {"role": "system", "content": "You are a skilled web designer. Generate CSS code only, no explanations."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 2000
                }
                
                claude_start = get_beijing_time()
                app.logger.info(f"开始调用 Claude API - {format_beijing_time(claude_start)}")
                
                response = requests.post(baseurl, json=body, headers=headers, timeout=45) # Increased timeout for Claude as well
                
                claude_end = get_beijing_time()
                claude_duration = calculate_duration(claude_start, claude_end)
                
                if response.status_code == 200:
                    app.logger.info(f"Claude API 调用成功 - 耗时: {claude_duration:.3f}秒")
                    result = response.json()
                    raw_content = result['choices'][0]['message']['content']
                    app.logger.info(f"Claude 返回内容长度: {len(raw_content)} 字符")
                    app.logger.debug(f"Claude 原始返回内容: {raw_content[:200]}...")
                    
                    extracted_css = extract_css_from_response(raw_content)
                    app.logger.info(f"CSS 提取完成，长度: {len(extracted_css)} 字符")
                    return extracted_css
                # Log the full response text for non-200 status for better debugging
                error_message = f"API2 failed with status {response.status_code}"
                try:
                    error_details = response.json() # Try to get JSON error details
                    error_message += f" - Details: {json.dumps(error_details)}"
                except ValueError: # If response is not JSON
                    error_message += f" - Content: {response.text}"
                app.logger.error(error_message)
                raise Exception(error_message)
                                

        except Exception as e:
            app.logger.error(f"Error in generate_ai_style_with_retry attempt {attempt + 1}/{max_retries}: {str(e)}", exc_info=True)
            if attempt == max_retries - 1:
                raise Exception(f"Failed to generate style after {max_retries} attempts: {str(e)}")
            time.sleep(1)

def merge_styles(existing_style, new_style):
    """
    合并两个CSS样式
    
    Args:
        existing_style (str): 现有的CSS样式
        new_style (str): 新生成的CSS样式
    
    Returns:
        str: 合并后的CSS样式
    """
    try:
        # 移除可能的重复选择器
        existing_selectors = extract_selectors(existing_style)
        new_style_lines = new_style.split('\n')
        merged_lines = []
        current_selector = None
        
        for line in new_style_lines:
            line = line.strip()
            if not line:
                continue
                
            # 检查是否是选择器行
            if '{' in line and '}' not in line:
                current_selector = line.split('{')[0].strip()
                if current_selector in existing_selectors:
                    # 如果选择器已存在,跳过这个规则块
                    while line and '}' not in line:
                        line = next(new_style_lines, '').strip()
                    continue
                    
            merged_lines.append(line)
            
        # 合并样式
        merged_style = existing_style.strip() + "\n\n" + "\n".join(merged_lines)
        
        # 清理格式
        merged_style = re.sub(r'\n\s*\n', '\n\n', merged_style)
        merged_style = merged_style.strip()
        
        return merged_style
        
    except Exception as e:
        app.logger.error(f"Error merging styles: {str(e)}")
        # 如果合并失败,返回两个样式的简单拼接
        return f"{existing_style.strip()}\n\n{new_style.strip()}"

def extract_selectors(css_code):
    """
    从CSS代码中提取所有选择器
    
    Args:
        css_code (str): CSS代码
    
    Returns:
        set: 选择器集合
    """
    selectors = set()
    # 使用正则表达式匹配选择器
    pattern = r'([^{]+){[^}]*}'
    matches = re.finditer(pattern, css_code)
    
    for match in matches:
        selector = match.group(1).strip()
        selectors.add(selector)
        
    return selectors

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


# 添加新的API路由用于处理元素样式生成
@app.route('/api/generate_element_style', methods=['POST'])
def generate_element_style():
    data = request.json
    element_details = data.get('elementDetails')
    description = data.get('description')
    url = data.get('url')
    existing_style = data.get('existingStyle')  # 从请求中获取本地存储的样式信息
    style_id = data.get('styleId')  # 从请求中获取 style_id

    if not all([element_details, description, url]):
        return jsonify({"success": False, "error": "Missing required data"}), 400

    try:
        # 生成提示
        prompt = generate_element_style_prompt(
            element_details,
            description,
            existing_style['style_code'] if existing_style else None
        )
        
        # 生成样式
        generated_style = generate_ai_style_for_element(prompt)
        element_selector = element_details['elementInfo']['path']
        
        if style_id:  # 使用传入的 style_id
            existing_css = existing_style['style_code'] if existing_style else ''
            
            # 移除该元素可能存在的旧样式
            if existing_css:
                existing_css = remove_element_style(existing_css, element_selector)
            
            # 合并新样式
            combined_style = f"{existing_css}\n\n{element_selector} {{\n{generated_style}\n}}" if existing_css else f"{element_selector} {{\n{generated_style}\n}}"
            
            # 根据style_id更新或创建数据库记录
            style = Style.query.filter_by(style_id=style_id).first()
            if style:
                style.style_code = combined_style
                style.updated_at = get_beijing_time()
                app.logger.info(f"Updated existing style record with ID {style_id}")
            else:
                # 如果找不到记录,创建新记录但使用传入的style_id
                style = Style(
                    style_id=style_id,
                    name=f"Style for {url}",
                    description=f"Combined style for {url}",
                    style_url=url,
                    style_code=combined_style,
                    style_type='custom',
                    created_at=get_beijing_time()
                )
                db.session.add(style)
                app.logger.info(f"Created new style record with provided ID {style_id}")
        else:
            # 如果没有传入style_id(不应该发生)
            app.logger.error("No style_id provided in request")
            return jsonify({"success": False, "error": "No style_id provided"}), 400
        
        # 添加重试机制
        max_retries = 3
        for attempt in range(max_retries):
            try:
                db.session.commit()
                break
            except sqlalchemy.exc.OperationalError as e:
                if attempt == max_retries - 1:
                    raise
                db.session.rollback()
                db.session.remove()
                time.sleep(1)
        
        return jsonify({
            "success": True,
            "style": generated_style,
            "styleId": style_id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error in generate_element_style: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500

# 生成用于元素样式的AI提示
def generate_element_style_prompt(element_details, description, existing_style=None):
    """
    生成用于元素样式的AI提示
    """
    base_prompt = f"""
    Generate CSS styles for the following HTML element:
    
    Element Details:
    - Tag: {element_details['elementInfo']['tagName']}
    - ID: {element_details['elementInfo']['id']}
    - Class: {element_details['elementInfo']['className']}
    - CSS Path: {element_details['elementInfo']['path']}
    
    Element Structure:
    {element_details['structure']}
    
    Current Computed Styles:
    {json.dumps(element_details['styleInfo']['computed'], indent=2)}
    
    User Requirements:
    {description}
    
    Please generate CSS that:
    1. Maintains the element's core functionality
    2. Implements the requested visual changes
    3. Ensures compatibility with existing styles
    4. Uses modern CSS features appropriately
    5. Maintains responsive design principles
    
    Return only the CSS code without any explanations or comments.
    """
    
    if existing_style:
        base_prompt += f"""
        
        Consider these existing site styles while generating new ones:
        {existing_style}
        
        Ensure the new styles integrate well with the existing ones.
        """
    
    return base_prompt

# 使用AI生成元素样式
def generate_ai_style_for_element(prompt):
    """
    使用AI生成元素样式
    """
    try:
        # 首先尝试API2 (Claude)
        try:
            baseurl = "https://api.link-ai.tech/v1/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": "Bearer Link_tYOZdFTnf0RDsOkryM5gk8lrUkwIBLZDFirsZko8XH"
            }
            body = {
                "app_code": "",
                "model": "claude-3-5-sonnet",
                "messages": [
                    {
                        "role": "system", 
                        "content": "You are a skilled web designer. Generate CSS code only, no explanations."
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                "temperature": 0.7,
                "max_tokens": 2000
            }
            
            response = requests.post(baseurl, json=body, headers=headers, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                raw_content = result['choices'][0]['message']['content']
                return extract_css_from_response(raw_content)
            else:
                raise Exception(f"API2 failed with status {response.status_code}")
            
        except Exception as e:
            app.logger.warning(f"API2 failed, trying API1: {str(e)}")
            
            # 如果API2失败,尝试API1 (Deepseek)
            api_key = os.environ.get('DEEPSEEK_API_KEY', "sk-a76edfa9a4fa4bab8a25eb030738e14d")
            client = OpenAI(
                api_key=api_key,
                base_url="https://api.deepseek.com"
            )
            
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a skilled web designer. Generate CSS code only, no explanations."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=2000,
                stream=False,
                timeout=30
            )
            
            raw_content = response.choices[0].message.content
            return extract_css_from_response(raw_content)
            
    except Exception as e:
        app.logger.error(f"Error generating element style: {str(e)}", exc_info=True)
        raise Exception(f"Failed to generate style: {str(e)}")

#从CSS代码中移除指定元素的样式
def remove_element_style(css_code, element_selector):
    """
    从CSS代码中移除指定元素的样式
    
    Args:
        css_code (str): 原CSS代码
        element_selector (str): 要移除样式的元素选择器
    
    Returns:
        str: 移除指定元素样式后的CSS代码
    """
    # 转义选择器中的特殊字符
    escaped_selector = re.escape(element_selector)
    
    # 匹配选择器及其样式块的正则表达式
    pattern = rf"{escaped_selector}\s*{{[^}}]*}}"
    
    # 移除匹配的样式
    cleaned_css = re.sub(pattern, '', css_code)
    
    # 移除多余的空行
    cleaned_css = re.sub(r'\n\s*\n', '\n\n', cleaned_css)
    
    return cleaned_css.strip()

# 主程序入口
if __name__ == '__main__':
    app.run()
