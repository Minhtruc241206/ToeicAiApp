import json
from model import Topic,Word,UserWord,db


def getList():
    with open("data/data2.json", encoding="utf-8") as f:
        return json.load(f)

def get50topic():
    return Topic.query.all()


def get_user_mastered(user_id):
    """Lấy danh sách các word_key mà user đã thuộc (VD: ['1::abide by', '2::market'])"""
    rows = UserWord.query.filter_by(user_id=user_id).all()
    return [r.word_key for r in rows]


def update_user_word(user_id, word_key, is_known):
    """Lưu hoặc xóa trạng thái Đã thuộc của 1 từ"""
    record = UserWord.query.filter_by(user_id=user_id, word_key=word_key).first()

    if is_known:
        # Nếu đánh dấu Đã thuộc mà trong DB chưa có -> Thêm mới
        if not record:
            new_item = UserWord(user_id=user_id, word_key=word_key)
            db.session.add(new_item)
            db.session.commit()
    else:
        # Nếu đánh dấu Cần ôn lại mà trong DB đang có -> Xóa khỏi danh sách Đã thuộc
        if record:
            db.session.delete(record)
            db.session.commit()