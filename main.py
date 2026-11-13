import os
from dotenv import load_dotenv
from flask import Flask, render_template, url_for, redirect, session
from flask_login import LoginManager, login_user
from authlib.integrations.flask_client import OAuth
from model import User, db,app
import dao

load_dotenv()
login_manager = LoginManager(app)
oauth = OAuth(app)
app.secret_key="NMT"


google = oauth.register(
    name='google',
    client_id=os.getenv('GOOGLE_CLIENT_ID'),
    client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

@app.route('/')
def hellomain():
    return render_template('main.html')

@app.route('/dashboard')
def dashboard():
    data=dao.getList()
    return render_template('dashboard.html',data=data)

@app.route('/login/google')
def login_google():
    # Tạo đường link bến đỗ để Google biết đường trả người dùng về
    redirect_uri = url_for('authorize', _external=True)
    return google.authorize_redirect(redirect_uri)

@app.route('/authorize')
def authorize():
    # 1. Nhận dữ liệu (Tờ giấy chứng nhận) từ Google gửi về
    token = google.authorize_access_token()
    user_info = token.get('userinfo')

    # Lấy email của người dùng
    email_nhan_duoc = user_info['email']
    name = user_info['name']
    picture = user_info['picture']

    # 2. Kiểm tra xem email này đã có trong Database của bạn chưa
    user = User.query.filter_by(username=email_nhan_duoc).first()

    if not user:
        # 3. NẾU LÀ NGƯỜI MỚI: Tự động tạo tài khoản luôn cho họ
        # Gán username chính là email, mật khẩu sinh ngẫu nhiên vì không cần xài
        import uuid
        user = User(username=email_nhan_duoc, password=str(uuid.uuid4()),name = name,picture = picture,mota="asd")
        db.session.add(user)
        db.session.commit()


    # 4. KẾT NỐI VỚI FLASK-LOGIN (Phép thuật nằm ở đây)
    # Bất kể là user cũ hay user vừa tạo mới, chỉ cần ném vào hàm này là có Session!
    login_user(user)

    # Đăng nhập xong thì đưa về trang chủ
    return redirect('/dashboard')


@login_manager.user_loader
def load_user(user_id):
    print("load_user nhận:", repr(user_id))
    u = User.query.get(user_id)
    print("load_user tìm được:", u)
    return u


@app.route('/policy')
def policy():
    print("session:",session)
    return render_template('policy.html')
@app.route('/ai-quiz')
def ToeicTesterAI():
    return render_template('index.html')

@app.route('/thongtin')
def thongtin():
    return render_template('thongtin.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/')
if __name__ == '__main__':
    app.run(debug=True)