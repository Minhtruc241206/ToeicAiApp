from flask import Flask
from flask_login import UserMixin
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, Integer, String, Double, ForeignKey, true

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
    def __str__(self):
        return self.username

if __name__=='__main__':
    with app.app_context():
        db.create_all()