# 🏗️ field-excel-mono

> 영수증 데이터 엑셀 자동화 시스템 

현장에서 수집된 원천자료 영수증을 OCR과 LLM으로 분석하여  
기존 엑셀 양식에 자동으로 입력·검증하는 통합 시스템입니다.

---

## 📁 프로젝트 구조

```
field-excel-mono/
├── ai-server/      # FastAPI + Python — OCR, LLM, 엑셀 처리
├── backend/        # Node.js + Express — REST API, 인증, 파일 관리
└── frontend/       # React + Vite — 사용자/관리자 화면
```

---

## 🛠️ 기술 스택

| 분류 | 기술 |
|------|------|
| 프론트엔드 | React + Vite, Tailwind CSS, Axios |
| 백엔드 | Node.js + Express, JWT + bcrypt, Multer |
| AI 서버 | FastAPI + Python, PaddleOCR, openpyxl, PyMuPDF + Pillow |
| LLM | 로컬 LLM |
| 데이터베이스 | MySQL |
| 버전 관리 | Git + GitHub |

---

## 🚀 포트 정보

| 서비스 | 포트 | 기술 |
|--------|------|------|
| frontend | http://localhost:3000 | React + Vite |
| backend | http://localhost:8080 | Node.js + Express |
| ai-server | http://localhost:8000 | FastAPI + Python |

---

## ⚙️ 환경변수

각 서비스 폴더의 `.env.example`을 복사하여 `.env`로 사용하세요.

### frontend `.env`
```dotenv
VITE_API_BASE=http://localhost:8080/api
VITE_AI_BASE=http://localhost:8000
```

### backend `.env`
```dotenv
PORT=8080

DB_HOST=localhost
DB_PORT=3306
DB_NAME=field_excel
DB_USER=
DB_PASSWORD=

JWT_SECRET=
AI_SERVER_URL=http://localhost:8000
```

### ai-server `.env`
```dotenv
BACKEND_URL=http://localhost:8080

DB_HOST=localhost
DB_PORT=3306
DB_NAME=field_excel
DB_USER=
DB_PASSWORD=
```

---

## 💻 실행 방법

### frontend
```bash
cd frontend
npm install
npm run dev
```

### backend
```bash
cd backend
npm install
node server.js
```

### ai-server
```bash
cd ai-server
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

---

## 📌 주요 기능

- 📄 원천자료(사진, PDF, 영수증 등) 업로드
- 🔍 PaddleOCR 기반 텍스트 추출
- 🤖 LLM을 통한 구조화 JSON 변환
- ✅ 규칙 기반 정합성 검증 (누락값, 계산 오류 등)
- 📊 기존 엑셀 템플릿에 자동 입력 (openpyxl)
- 🔐 JWT 기반 권한별 접근 제어

---

## 👤 개발자

| 이름 | 역할 |
|------|------|
| 이진근 | Frontend / Backend / AI 통합 개발 |