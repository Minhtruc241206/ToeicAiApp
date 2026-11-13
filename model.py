from flask import Flask, json
from flask_login import UserMixin
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, Integer, String, Double, ForeignKey, true, Boolean

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] ="mysql+pymysql://root:root@localhost/toeic?charset=utf8mb4"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = True

db = SQLAlchemy(app)

class User(db.Model,UserMixin):
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50),nullable=True)
    password = Column(String(50),nullable=True)
    name = Column(String(100), nullable=True)
    picture = Column(String(500), nullable=True)
    mota = Column(String(255), nullable=True)
    active = Column(Boolean,default=False)
    def __str__(self):
        return self.username


class Topic(db.Model):
    __tablename__ = 'topics'
    id = db.Column(db.Integer, primary_key=True)
    topic_en = db.Column(db.String(150), nullable=False)
    topic_vi = db.Column(db.String(150), nullable=False)

    # Relationship 1-Nhiều với bảng Word
    words = db.relationship('Word', backref='topic', lazy=True, cascade="all, delete-orphan")


class Word(db.Model):
    __tablename__ = 'words'
    id = db.Column(db.Integer, primary_key=True)
    topic_id = db.Column(db.Integer, db.ForeignKey('topics.id'), nullable=False)

    word = db.Column(db.String(100), nullable=False)
    pos = db.Column(db.String(50))
    ipa = db.Column(db.String(100))
    meaning = db.Column(db.String(255), nullable=False)
    example_en = db.Column(db.Text)
    example_vi = db.Column(db.Text)
    usage = db.Column(db.Text)

    # Mảng trong JSON sẽ được chuyển thành chuỗi (String) cách nhau bởi dấu phẩy
    synonyms = db.Column(db.Text)
    word_family = db.Column(db.Text)

if __name__=='__main__':
    with app.app_context():
        db.create_all()
        with open('data/data.json', encoding='utf-8') as file:
            data = json.load(file)

        print("Đang tiến hành import dữ liệu...")

        for topic_data in data:
            # Kiểm tra xem Topic đã có trong DB chưa để tránh trùng lặp
            topic = Topic.query.get(topic_data['topic_id'])
            if not topic:
                topic = Topic(
                    id=topic_data['topic_id'],
                    topic_en=topic_data['topic_en'],
                    topic_vi=topic_data['topic_vi']
                )
                db.session.add(topic)

            for word_data in topic_data['words']:
                word = Word.query.get(word_data['id'])
                if not word:
                    # Nối mảng synonyms và word_family thành chuỗi string (ngăn cách bởi dấu phẩy)
                    synonyms_str = ", ".join(word_data.get('synonyms', []))
                    family_str = ", ".join(word_data.get('word_family', []))

                    word = Word(
                        id=word_data['id'],
                        topic_id=topic_data['topic_id'],
                        word=word_data['word'],
                        pos=word_data['pos'],
                        ipa=word_data['ipa'],
                        meaning=word_data['meaning'],
                        example_en=word_data['example_en'],
                        example_vi=word_data['example_vi'],
                        usage=word_data['usage'],
                        synonyms=synonyms_str,
                        word_family=family_str
                    )
                    db.session.add(word)

        # Lưu tất cả thay đổi vào Database
        db.session.commit()
        print("Đã import thành công 50 chủ đề và 600 từ vựng vào Database!")