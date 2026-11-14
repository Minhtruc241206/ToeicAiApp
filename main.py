from flask import render_template, request, redirect, url_for, session, jsonify
import os
from dotenv import load_dotenv
from flask_login import LoginManager, login_user, current_user,login_required
from authlib.integrations.flask_client import OAuth
from model import User, db, app, Word, Topic
import dao
from flask_admin import Admin
from flask_admin.contrib.sqla import ModelView


load_dotenv()
login_manager = LoginManager(app)
oauth = OAuth(app)
app.secret_key="NMT241206"
# -------------# quan tri admin
admin = Admin(app, name="Quản trị TOEIC AI")
class AuthenticatedView(ModelView):
    def is_accessible(self):
        return current_user.is_authenticated and current_user.active == True
admin.add_view(AuthenticatedView(User, db.session))
admin.add_view(AuthenticatedView(Topic, db.session))
admin.add_view(AuthenticatedView(Word, db.session))

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
    return User.query.get(int(user_id))

@app.route('/policy')
def policy():
    # data=dao.get50topic()
    # for i in data:
    #     print(i.id)
    #     for x in i.words:
    #         print(x.word)
    return render_template('policy.html')
@app.route('/ai-quiz')
def ToeicTesterAI():
    return render_template('index.html')

@app.route('/thongtin')
def thongtin():
    return render_template('thongtin.html')
@app.route('/topics')
def topics():

    rows = Topic.query.order_by(Topic.id).all()  # đổi tên model cho đúng với bạn
    topic = [{
        "id": t.id,
        "topic_en": t.topic_en,
        "topic_vi": t.topic_vi,
        "words": [{
            "word": w.word, "ipa": w.ipa, "pos": w.pos,
            "meaning": w.meaning,
            "example_en": w.example_en, "example_vi": w.example_vi,
            "usage": w.usage,
            "synonyms": w.synonyms, "word_family": w.word_family,
        } for w in t.words],
    } for t in rows]
    mastered_list = []
    if current_user.is_authenticated:
        mastered_list = dao.get_user_mastered(current_user.id)

    return render_template('topic.html',topic = topic,mastered_list=mastered_list)

@app.route('/api/progress', methods=['POST'])
def save_vocab_progress():
    # Nếu chưa đăng nhập thì báo cho trình duyệt biết để lưu tạm vào localStorage
    if not current_user.is_authenticated:
        return jsonify({"status": "guest"}), 200

    data = request.get_json() or {}
    word_key = data.get('word_key')
    is_known = bool(data.get('is_known'))

    if word_key:
        dao.update_user_word(current_user.id, word_key, is_known)

    return jsonify({"status": "ok"})


@app.route('/logout')
def logout():
    session.clear()
    return redirect('/')
if __name__ == '__main__':
    app.run(debug=True)