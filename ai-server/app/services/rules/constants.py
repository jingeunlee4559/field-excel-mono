EXPENSE_CATEGORIES = [
    {"code": "MEAL", "name": "식비"},
    {"code": "TRANSPORT", "name": "교통비"},
    {"code": "LODGING", "name": "숙박비"},
    {"code": "SUPPLIES", "name": "소모품비"},
    {"code": "FUEL", "name": "유류비"},
    {"code": "COMMUNICATION", "name": "통신비"},
    {"code": "MATERIAL", "name": "자재비"},
    {"code": "ETC", "name": "기타"},
]

CATEGORY_CODE_TO_NAME = {item["code"]: item["name"] for item in EXPENSE_CATEGORIES}
CATEGORY_NAME_TO_CODE = {item["name"]: item["code"] for item in EXPENSE_CATEGORIES}

VALID_CATEGORY_CODES = set(CATEGORY_CODE_TO_NAME.keys())
VALID_CATEGORY_NAMES = set(CATEGORY_NAME_TO_CODE.keys())

SUPPLEMENT_ACTION = "SUPPLEMENT_REQUEST_CANDIDATE"
MANAGEMENT_REVIEW_ACTION = "MANAGEMENT_REVIEW"
PASS_ACTION = "PASS"

ITEM_NOISE_KEYWORDS = [
    # 영수증/문서 제목 및 구조
    "영수증", "거래명세", "명세서", "전표", "재발행", "교환", "환불", "문의",
    "상품명", "품명", "수량", "단가", "금액", "금 액", "소계", "합계", "총계", "총액",
    "판매", "판매합계", "판매 합계", "받을금액", "받은금액", "거스름돈",

    # 세금/정산 라인
    "공급가액", "공급가", "부가세", "부가가치세", "과세", "면세", "과세물품", "면세물품",
    "과세금액", "면세금액", "세액", "부가세액",

    # 결제/승인/카드/포인트
    "카드", "신용", "체크", "간편결제", "결제", "승인", "승인번호", "승인일시",
    "거래번호", "전표번호", "카드번호", "할부", "일시불", "포인트", "멤버십", "적립",
    "잔액", "잔여", "가용포인트",

    # 사업자/매장/주소/연락처
    "매장", "가맹점", "점포", "지점", "본사", "주소", "도로명", "사업자", "사업자번호",
    "대표", "대표자", "전화", "TEL", "Fax", "FAX", "고객센터", "홈페이지",

    # 인증/홍보/안내성 문구
    "소비자중심", "품질경영", "인증기업", "감사합니다", "이용해", "방문해",
]

REQUIRED_FIELDS = [
    ("vendor_name", "vendor_name", "사용처"),
    ("expense_date", "receipt_date", "사용일자"),
    ("total_amount", "amount", "금액"),
]
