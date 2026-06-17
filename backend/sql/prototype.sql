
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP DATABASE IF EXISTS prototypedb2;

CREATE DATABASE prototypedb2
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE prototypedb2;

-- =========================================================
-- 1. roles
-- =========================================================

CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_code VARCHAR(50) NOT NULL UNIQUE,
  role_name VARCHAR(50) NOT NULL,
  description VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO roles (role_code, role_name, description) VALUES
('SYSTEM_ADMIN', '시스템 관리자', '사용자 관리, 템플릿 등록, 매핑 설정, 기준정보 관리를 담당하는 사용자'),
('MANAGER', '관리팀 사용자', '템플릿 등록, 매핑 설정, 검토, 보완요청, 경비청구서 확인 및 다운로드를 담당하는 사용자'),
('SUBMITTER', '증빙 제출자', '경비 증빙자료 업로드 및 보완자료 재업로드를 담당하는 사용자');


-- =========================================================
-- 2. departments
-- =========================================================

CREATE TABLE departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  department_name VARCHAR(100) NOT NULL,
  department_code VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255),
  is_signup_visible BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO departments
(department_name, department_code, description, is_signup_visible, is_active)
VALUES
('시스템관리', 'SYS', '시스템 관리자 전용 부서', FALSE, TRUE),
('관리팀', 'MGMT', '템플릿 등록, 매핑 설정, 검토, 보완요청, 경비청구서 다운로드를 담당하는 부서', FALSE, TRUE),
('공사팀', 'CONSTRUCTION', '현장 증빙자료 업로드 및 공사 관련 자료를 처리하는 부서', TRUE, TRUE),
('감리팀', 'SUPERVISION', '현장 감리 및 검측 관련 자료를 처리하는 부서', TRUE, TRUE);


-- =========================================================
-- 3. sites
-- =========================================================

CREATE TABLE sites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  site_name VARCHAR(100) NOT NULL,
  site_code VARCHAR(50) NOT NULL UNIQUE,
  address VARCHAR(255),
  description VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO sites
(site_name, site_code, address, description, is_active)
VALUES
('A현장', 'SITE_A', '서울시 강남구', '프로토타입 테스트 현장 A', TRUE),
('B현장', 'SITE_B', '경기도 성남시', '프로토타입 테스트 현장 B', TRUE),
('순천현장', 'SITE_SUNCHEON', '전라남도 순천시', '순천 지역 현장', TRUE),
('광양현장', 'SITE_GWANGYANG', '전라남도 광양시', '광양 지역 현장', TRUE);


-- =========================================================
-- 4. users
-- =========================================================

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,

  role_id INT NOT NULL,
  role VARCHAR(50) NOT NULL,
  role_code VARCHAR(50) NOT NULL,

  department_id INT,
  site_id INT,

  email VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  password VARCHAR(255) NULL,

  name VARCHAR(50) NOT NULL,
  phone VARCHAR(30),

  status ENUM('PENDING', 'ACTIVE', 'INACTIVE', 'REJECTED') DEFAULT 'ACTIVE',
  is_active BOOLEAN DEFAULT TRUE,
  must_change_password BOOLEAN DEFAULT FALSE,

  created_by INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_users_email (email),
  KEY idx_users_role_id (role_id),
  KEY idx_users_role (role),
  KEY idx_users_role_code (role_code),
  KEY idx_users_department_id (department_id),
  KEY idx_users_site_id (site_id),
  KEY idx_users_status (status),

  CONSTRAINT fk_users_role
    FOREIGN KEY (role_id) REFERENCES roles(id),

  CONSTRAINT fk_users_department
    FOREIGN KEY (department_id) REFERENCES departments(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_users_site
    FOREIGN KEY (site_id) REFERENCES sites(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_users_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
);

-- 비밀번호: 1234
-- bcrypt hash: $2b$10$UJq2N0raA7hR1GQuHGZpc.Y6l6ZnMdIRcjlOPxFMzIr1Ikefv0RZy

INSERT INTO users
(role_id, role, role_code, department_id, site_id, email, password_hash, password, name, phone, status, is_active, must_change_password)
VALUES
(
  (SELECT id FROM roles WHERE role_code = 'SYSTEM_ADMIN'),
  'SYSTEM_ADMIN', 'SYSTEM_ADMIN',
  (SELECT id FROM departments WHERE department_code = 'SYS'),
  NULL,
  'admin@example.com',
  '$2b$10$UJq2N0raA7hR1GQuHGZpc.Y6l6ZnMdIRcjlOPxFMzIr1Ikefv0RZy',
  '$2b$10$UJq2N0raA7hR1GQuHGZpc.Y6l6ZnMdIRcjlOPxFMzIr1Ikefv0RZy',
  '시스템 관리자', '010-0000-0000', 'ACTIVE', TRUE, FALSE
),
(
  (SELECT id FROM roles WHERE role_code = 'MANAGER'),
  'MANAGER', 'MANAGER',
  (SELECT id FROM departments WHERE department_code = 'MGMT'),
  NULL,
  'manager@example.com',
  '$2b$10$UJq2N0raA7hR1GQuHGZpc.Y6l6ZnMdIRcjlOPxFMzIr1Ikefv0RZy',
  '$2b$10$UJq2N0raA7hR1GQuHGZpc.Y6l6ZnMdIRcjlOPxFMzIr1Ikefv0RZy',
  '관리팀 사용자', '010-5555-5555', 'ACTIVE', TRUE, FALSE
),
(
  (SELECT id FROM roles WHERE role_code = 'SUBMITTER'),
  'SUBMITTER', 'SUBMITTER',
  (SELECT id FROM departments WHERE department_code = 'CONSTRUCTION'),
  (SELECT id FROM sites WHERE site_code = 'SITE_A'),
  'construction1@example.com',
  '$2b$10$UJq2N0raA7hR1GQuHGZpc.Y6l6ZnMdIRcjlOPxFMzIr1Ikefv0RZy',
  '$2b$10$UJq2N0raA7hR1GQuHGZpc.Y6l6ZnMdIRcjlOPxFMzIr1Ikefv0RZy',
  '공사팀사용자1', '010-1111-1111', 'ACTIVE', TRUE, FALSE
),
(
  (SELECT id FROM roles WHERE role_code = 'SUBMITTER'),
  'SUBMITTER', 'SUBMITTER',
  (SELECT id FROM departments WHERE department_code = 'CONSTRUCTION'),
  (SELECT id FROM sites WHERE site_code = 'SITE_SUNCHEON'),
  'construction2@example.com',
  '$2b$10$UJq2N0raA7hR1GQuHGZpc.Y6l6ZnMdIRcjlOPxFMzIr1Ikefv0RZy',
  '$2b$10$UJq2N0raA7hR1GQuHGZpc.Y6l6ZnMdIRcjlOPxFMzIr1Ikefv0RZy',
  '순천공사담당자', '010-2222-2222', 'ACTIVE', TRUE, FALSE
),
(
  (SELECT id FROM roles WHERE role_code = 'SUBMITTER'),
  'SUBMITTER', 'SUBMITTER',
  (SELECT id FROM departments WHERE department_code = 'SUPERVISION'),
  (SELECT id FROM sites WHERE site_code = 'SITE_A'),
  'supervision1@example.com',
  '$2b$10$UJq2N0raA7hR1GQuHGZpc.Y6l6ZnMdIRcjlOPxFMzIr1Ikefv0RZy',
  '$2b$10$UJq2N0raA7hR1GQuHGZpc.Y6l6ZnMdIRcjlOPxFMzIr1Ikefv0RZy',
  '감리팀사용자1', '010-3333-3333', 'ACTIVE', TRUE, FALSE
),
(
  (SELECT id FROM roles WHERE role_code = 'SUBMITTER'),
  'SUBMITTER', 'SUBMITTER',
  (SELECT id FROM departments WHERE department_code = 'SUPERVISION'),
  (SELECT id FROM sites WHERE site_code = 'SITE_GWANGYANG'),
  'supervision2@example.com',
  '$2b$10$UJq2N0raA7hR1GGuHGZpc.Y6l6ZnMdIRcjlOPxFMzIr1Ikefv0RZy',
  '$2b$10$UJq2N0raA7hR1GGuHGZpc.Y6l6ZnMdIRcjlOPxFMzIr1Ikefv0RZy',
  '광양감리담당자', '010-4444-4444', 'ACTIVE', TRUE, FALSE
);


-- =========================================================
-- 5. expense_categories
-- =========================================================

CREATE TABLE expense_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_code VARCHAR(50) NOT NULL UNIQUE,
  category_name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO expense_categories
(category_code, category_name, description, is_active)
VALUES
('MEAL', '식비', '식사, 음식점, 도시락 등 식대 관련 비용', TRUE),
('TRANSPORT', '교통비', 'KTX, 버스, 택시, 지하철, 주차비, 통행료 등 이동 관련 비용', TRUE),
('LODGING', '숙박비', '호텔, 모텔, 숙소 등 숙박 관련 비용', TRUE),
('SUPPLIES', '소모품비', '사무용품, 현장 소모품 등 소모성 물품 비용', TRUE),
('FUEL', '유류비', '주유, 충전 등 차량 연료 비용', TRUE),
('COMMUNICATION', '통신비', '전화, 인터넷, 통신 관련 비용', TRUE),
('MATERIAL', '자재비', '현장 자재 구매 관련 비용', TRUE),
('ETC', '기타', '분류가 어려운 기타 비용', TRUE);


-- =========================================================
-- 6. standard_fields
-- =========================================================

CREATE TABLE standard_fields (
  id INT AUTO_INCREMENT PRIMARY KEY,

  field_key VARCHAR(100) NOT NULL UNIQUE,
  field_name VARCHAR(100) NOT NULL,
  field_label VARCHAR(100) NOT NULL,

  field_scope ENUM('HEADER', 'DETAIL', 'SUMMARY') DEFAULT 'DETAIL',

  data_type ENUM('text', 'number', 'date', 'time', 'datetime', 'textarea', 'boolean') NOT NULL DEFAULT 'text',
  field_type ENUM('text', 'number', 'date', 'datetime', 'boolean') NOT NULL DEFAULT 'text',

  default_mapping_type ENUM('SINGLE_CELL', 'REPEAT_COLUMN') NOT NULL DEFAULT 'REPEAT_COLUMN',

  is_required BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,

  description VARCHAR(500),

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_standard_fields_active (is_active),
  KEY idx_standard_fields_scope (field_scope),
  KEY idx_standard_fields_sort (sort_order)
);

INSERT INTO standard_fields
(field_key, field_name, field_label, field_scope, data_type, field_type, default_mapping_type, is_required, sort_order, is_active, description)
VALUES
('document_no', '문서번호', '문서번호', 'HEADER', 'text', 'text', 'SINGLE_CELL', FALSE, 1, TRUE, '정산서, 보고서, 증빙 문서 번호'),
('document_type', '문서유형', '문서유형', 'HEADER', 'text', 'text', 'SINGLE_CELL', FALSE, 2, TRUE, '영수증, 거래명세서, 납품서, 작업일보 등 자료 유형'),
('document_title', '문서제목', '문서제목', 'HEADER', 'text', 'text', 'SINGLE_CELL', FALSE, 3, TRUE, '문서 제목'),
('expense_title', '제목', '제목', 'HEADER', 'text', 'text', 'SINGLE_CELL', FALSE, 4, TRUE, '경비청구서 제목 또는 정산 제목'),

('department_name', '부서명', '부서명', 'HEADER', 'text', 'text', 'SINGLE_CELL', TRUE, 10, TRUE, '작성자 또는 사용자 부서명'),
('site_name', '현장명', '현장명', 'HEADER', 'text', 'text', 'SINGLE_CELL', TRUE, 11, TRUE, '증빙자료가 연결되는 현장명'),
('site_code', '현장코드', '현장코드', 'HEADER', 'text', 'text', 'SINGLE_CELL', FALSE, 12, TRUE, '현장 식별 코드'),
('project_name', '프로젝트명', '프로젝트명', 'HEADER', 'text', 'text', 'SINGLE_CELL', FALSE, 13, TRUE, '프로젝트 또는 공사명'),
('project_code', '프로젝트코드', '프로젝트코드', 'HEADER', 'text', 'text', 'SINGLE_CELL', FALSE, 14, TRUE, '프로젝트 식별 코드'),

('user_name', '사용자', '사용자', 'HEADER', 'text', 'text', 'SINGLE_CELL', TRUE, 20, TRUE, '경비 사용자 또는 작성자명'),
('employee_no', '사번', '사번', 'HEADER', 'text', 'text', 'SINGLE_CELL', FALSE, 21, TRUE, '사용자 사번'),
('position_name', '직급', '직급', 'HEADER', 'text', 'text', 'SINGLE_CELL', FALSE, 22, TRUE, '사용자 직급'),

('created_date', '작성일자', '작성일자', 'HEADER', 'date', 'date', 'SINGLE_CELL', FALSE, 30, TRUE, '문서 작성일자'),
('submitted_at', '제출일시', '제출일시', 'HEADER', 'datetime', 'datetime', 'SINGLE_CELL', FALSE, 31, TRUE, '자료 제출 또는 업로드 일시'),

('approval_status', '승인상태', '승인상태', 'HEADER', 'text', 'text', 'SINGLE_CELL', FALSE, 40, TRUE, '승인 대기, 승인, 반려 등 승인 상태'),
('reviewer_name', '검토자', '검토자', 'HEADER', 'text', 'text', 'SINGLE_CELL', FALSE, 41, TRUE, '관리팀 검토자명'),
('approved_by', '승인자', '승인자', 'HEADER', 'text', 'text', 'SINGLE_CELL', FALSE, 42, TRUE, '최종 승인자명'),
('approved_at', '승인일시', '승인일시', 'HEADER', 'datetime', 'datetime', 'SINGLE_CELL', FALSE, 43, TRUE, '최종 승인 일시'),

('period_start_date', '기간시작일', '기간 시작일', 'HEADER', 'date', 'date', 'SINGLE_CELL', FALSE, 50, TRUE, '기간형 문서의 시작일'),
('period_end_date', '기간종료일', '기간 종료일', 'HEADER', 'date', 'date', 'SINGLE_CELL', FALSE, 51, TRUE, '기간형 문서의 종료일'),

('line_no', '번호', '번호', 'DETAIL', 'number', 'number', 'REPEAT_COLUMN', FALSE, 100, TRUE, '반복 내역 행 번호'),
('expense_date', '사용일자', '사용일자', 'DETAIL', 'date', 'date', 'REPEAT_COLUMN', TRUE, 110, TRUE, '영수증 사용일자 또는 결제일자'),
('transaction_date', '거래일자', '거래일자', 'DETAIL', 'date', 'date', 'REPEAT_COLUMN', FALSE, 111, TRUE, '거래명세서, 세금계산서 등의 거래일자'),
('delivery_date', '납품일자', '납품일자', 'DETAIL', 'date', 'date', 'REPEAT_COLUMN', FALSE, 112, TRUE, '납품서 기준 납품일자'),
('work_date', '작업일자', '작업일자', 'DETAIL', 'date', 'date', 'REPEAT_COLUMN', FALSE, 113, TRUE, '작업일보 기준 작업일자'),
('inspection_date', '검수일자', '검수일자', 'DETAIL', 'date', 'date', 'REPEAT_COLUMN', FALSE, 114, TRUE, '자재검수증 기준 검수일자'),
('issue_date', '발행일자', '발행일자', 'DETAIL', 'date', 'date', 'REPEAT_COLUMN', FALSE, 115, TRUE, '문서 발행일자'),
('due_date', '지급예정일', '지급예정일', 'DETAIL', 'date', 'date', 'REPEAT_COLUMN', FALSE, 116, TRUE, '지급 또는 정산 예정일'),

('vendor_name', '거래처명', '사용처', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', TRUE, 120, TRUE, '결제한 매장, 가맹점, 거래처명'),
('vendor_business_number', '거래처 사업자번호', '거래처 사업자번호', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 121, TRUE, '거래처 사업자등록번호'),
('business_number', '사업자등록번호', '사업자등록번호', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 122, TRUE, 'OCR/LLM 호환용 사업자등록번호 필드'),
('vendor_representative', '대표자명', '대표자명', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 123, TRUE, '거래처 대표자명'),
('vendor_address', '거래처 주소', '거래처 주소', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 124, TRUE, '거래처 주소'),
('vendor_phone', '거래처 전화번호', '거래처 전화번호', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 125, TRUE, '거래처 전화번호'),
('vendor_email', '거래처 이메일', '거래처 이메일', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 126, TRUE, '거래처 이메일'),
('vendor_type', '거래처 구분', '거래처 구분', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 127, TRUE, '가맹점, 협력사, 매입처 등 거래처 구분'),

('expense_category_code', '경비분류코드', '경비분류코드', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 130, TRUE, 'MEAL, TRANSPORT, SUPPLIES 등 경비 분류 코드'),
('expense_category_name', '경비분류명', '항목', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', TRUE, 131, TRUE, '식비, 교통비, 숙박비, 소모품비 등 경비 항목'),
('account_code', '계정과목코드', '계정과목코드', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 132, TRUE, '회계 계정 코드'),
('account_name', '계정과목명', '계정과목명', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 133, TRUE, '소모품비, 여비교통비 등 계정과목명'),
('cost_center', '코스트센터', '코스트센터', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 134, TRUE, '부서 또는 현장 비용 귀속 기준'),
('budget_code', '예산코드', '예산코드', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 135, TRUE, '예산 항목 코드'),

('item_code', '품목코드', '품목코드', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 200, TRUE, '품목 또는 자재 코드'),
('item_name', '품목명', '품목명', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 201, TRUE, '실제 상품명, 메뉴명, 자재명'),
('item_description', '품목설명', '품목설명', 'DETAIL', 'textarea', 'text', 'REPEAT_COLUMN', FALSE, 202, TRUE, '품목 상세 설명'),
('item_spec', '규격', '규격', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 203, TRUE, '품목 규격, 모델, 사양'),
('unit', '단위', '단위', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 204, TRUE, 'EA, 개, 박스, m 등 단위'),
('quantity', '수량', '수량', 'DETAIL', 'number', 'number', 'REPEAT_COLUMN', FALSE, 205, TRUE, '품목 수량'),
('unit_price', '단가', '단가', 'DETAIL', 'number', 'number', 'REPEAT_COLUMN', FALSE, 206, TRUE, '품목 단가'),
('amount', '금액', '금액', 'DETAIL', 'number', 'number', 'REPEAT_COLUMN', TRUE, 207, TRUE, '개별 지출 또는 품목 금액'),
('description', '적요', '적요', 'DETAIL', 'textarea', 'text', 'REPEAT_COLUMN', FALSE, 208, TRUE, '지출 내용 요약 또는 사용 내역'),
('note', '비고', '비고', 'DETAIL', 'textarea', 'text', 'REPEAT_COLUMN', FALSE, 209, TRUE, '추가 참고사항 또는 검토 메모'),

('supply_amount', '공급가액', '공급가액', 'SUMMARY', 'number', 'number', 'SINGLE_CELL', FALSE, 300, TRUE, '세전 공급가액'),
('tax_amount', '부가세', '부가세', 'SUMMARY', 'number', 'number', 'SINGLE_CELL', FALSE, 301, TRUE, '부가가치세 금액'),
('total_amount', '지출총액', '지출총액', 'SUMMARY', 'number', 'number', 'SINGLE_CELL', TRUE, 302, TRUE, '청구서 또는 영수증 전체 합계 금액'),
('paid_amount', '결제금액', '결제금액', 'SUMMARY', 'number', 'number', 'SINGLE_CELL', FALSE, 303, TRUE, '실제 결제 또는 승인된 금액'),
('discount_amount', '할인금액', '할인금액', 'SUMMARY', 'number', 'number', 'SINGLE_CELL', FALSE, 304, TRUE, '할인 또는 에누리 금액'),
('unpaid_amount', '미지급금액', '미지급금액', 'SUMMARY', 'number', 'number', 'SINGLE_CELL', FALSE, 305, TRUE, '미지급 금액'),
('taxable_amount', '과세금액', '과세금액', 'SUMMARY', 'number', 'number', 'SINGLE_CELL', FALSE, 306, TRUE, '과세 대상 금액'),
('tax_free_amount', '면세금액', '면세금액', 'SUMMARY', 'number', 'number', 'SINGLE_CELL', FALSE, 307, TRUE, '면세 대상 금액'),
('quantity_total', '총수량', '총수량', 'SUMMARY', 'number', 'number', 'SINGLE_CELL', FALSE, 308, TRUE, '전체 품목 수량 합계'),

('payment_method', '결제수단', '결제수단', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 400, TRUE, '법인카드, 개인카드, 현금, 계좌이체, 간편결제 등'),
('card_company', '카드사', '카드사', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 401, TRUE, '신한, 국민, 삼성 등 카드사'),
('card_number_masked', '카드번호', '카드번호', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 402, TRUE, '마스킹 처리된 카드번호'),
('approval_number', '승인번호', '승인번호', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 403, TRUE, '카드 또는 결제 승인번호'),
('approval_time', '승인시각', '승인시각', 'DETAIL', 'datetime', 'datetime', 'REPEAT_COLUMN', FALSE, 404, TRUE, '결제 승인 시각'),
('installment_months', '할부개월', '할부개월', 'DETAIL', 'number', 'number', 'REPEAT_COLUMN', FALSE, 405, TRUE, '일시불 또는 할부 개월 수'),
('receipt_type', '영수증구분', '영수증구분', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 406, TRUE, '카드영수증, 현금영수증 등 구분'),
('cash_receipt_number', '현금영수증번호', '현금영수증번호', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 407, TRUE, '현금영수증 승인 또는 식별 번호'),

('work_type', '작업구분', '작업구분', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 500, TRUE, '전기, 설비, 토목 등 작업 구분'),
('work_content', '작업내용', '작업내용', 'DETAIL', 'textarea', 'text', 'REPEAT_COLUMN', FALSE, 501, TRUE, '작업일보의 작업 내용'),
('worker_count', '작업인원', '작업인원', 'DETAIL', 'number', 'number', 'REPEAT_COLUMN', FALSE, 502, TRUE, '작업 투입 인원'),
('equipment_name', '장비명', '장비명', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 503, TRUE, '사용 장비명'),
('equipment_count', '장비수량', '장비수량', 'DETAIL', 'number', 'number', 'REPEAT_COLUMN', FALSE, 504, TRUE, '사용 장비 수량'),
('material_name', '자재명', '자재명', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 505, TRUE, '사용 또는 입고 자재명'),
('material_spec', '자재규격', '자재규격', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 506, TRUE, '자재 규격'),
('material_quantity', '자재수량', '자재수량', 'DETAIL', 'number', 'number', 'REPEAT_COLUMN', FALSE, 507, TRUE, '자재 수량'),
('weather', '날씨', '날씨', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 508, TRUE, '작업일보 날씨'),
('progress_rate', '공정률', '공정률', 'DETAIL', 'number', 'number', 'REPEAT_COLUMN', FALSE, 509, TRUE, '현장 공정률'),

('delivery_no', '납품번호', '납품번호', 'HEADER', 'text', 'text', 'SINGLE_CELL', FALSE, 600, TRUE, '납품서 번호'),
('order_no', '발주번호', '발주번호', 'HEADER', 'text', 'text', 'SINGLE_CELL', FALSE, 601, TRUE, '발주서 번호'),
('purchase_order_no', '구매발주번호', '구매발주번호', 'HEADER', 'text', 'text', 'SINGLE_CELL', FALSE, 602, TRUE, 'PO 번호'),
('inspection_no', '검수번호', '검수번호', 'HEADER', 'text', 'text', 'SINGLE_CELL', FALSE, 603, TRUE, '검수 문서 번호'),
('inspection_result', '검수결과', '검수결과', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 604, TRUE, '합격, 불합격 등 검수 결과'),
('defect_quantity', '불량수량', '불량수량', 'DETAIL', 'number', 'number', 'REPEAT_COLUMN', FALSE, 605, TRUE, '검수 불량 수량'),
('accepted_quantity', '합격수량', '합격수량', 'DETAIL', 'number', 'number', 'REPEAT_COLUMN', FALSE, 606, TRUE, '검수 합격 수량'),
('warehouse_name', '입고창고', '입고창고', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 607, TRUE, '입고 창고 또는 보관 위치'),
('delivery_location', '납품장소', '납품장소', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 608, TRUE, '납품 장소'),

-- 교통 영수증 전용 필드
('transport_type', '교통수단', '교통수단', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 700, TRUE, 'KTX, 시외버스, 고속버스, 택시 등 교통수단'),
('departure_place', '출발지', '출발지', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 701, TRUE, '교통 영수증의 출발지'),
('arrival_place', '도착지', '도착지', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 702, TRUE, '교통 영수증의 도착지'),
('boarding_datetime', '승차일시', '승차일시', 'DETAIL', 'datetime', 'datetime', 'REPEAT_COLUMN', FALSE, 703, TRUE, '열차, 버스, 택시 등 승차 일시'),
('seat_no', '좌석번호', '좌석번호', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 704, TRUE, '좌석번호'),
('route_name', '노선명', '노선명', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 705, TRUE, '교통 노선명'),
('ticket_no', '승차권번호', '승차권번호', 'DETAIL', 'text', 'text', 'REPEAT_COLUMN', FALSE, 706, TRUE, '승차권 또는 교통 영수증 번호');


-- =========================================================
-- 6-1. field_aliases
-- =========================================================

CREATE TABLE field_aliases (
  id INT AUTO_INCREMENT PRIMARY KEY,

  field_key VARCHAR(100) NOT NULL,
  alias_name VARCHAR(100) NOT NULL,
  document_type VARCHAR(50) NOT NULL DEFAULT 'RECEIPT',

  priority INT NOT NULL DEFAULT 100,
  active_yn CHAR(1) NOT NULL DEFAULT 'Y',

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_field_aliases_key_alias_doc (field_key, alias_name, document_type),
  KEY idx_field_aliases_field_key (field_key),
  KEY idx_field_aliases_alias_name (alias_name),
  KEY idx_field_aliases_document_type (document_type),
  KEY idx_field_aliases_active_yn (active_yn),

  CONSTRAINT fk_field_aliases_standard_field
    FOREIGN KEY (field_key) REFERENCES standard_fields(field_key)
    ON UPDATE CASCADE ON DELETE CASCADE
);

INSERT IGNORE INTO field_aliases
(field_key, alias_name, document_type, priority, active_yn)
VALUES
('document_type', '문서유형', 'RECEIPT', 10, 'Y'),
('document_type', '증빙유형', 'RECEIPT', 20, 'Y'),
('document_type', '자료유형', 'RECEIPT', 30, 'Y'),
('document_type', '영수증', 'RECEIPT', 40, 'Y'),
('document_type', '매출전표', 'RECEIPT', 50, 'Y'),

('expense_date', '사용일자', 'RECEIPT', 10, 'Y'),
('expense_date', '사용일', 'RECEIPT', 20, 'Y'),
('expense_date', '이용일자', 'RECEIPT', 30, 'Y'),
('expense_date', '결제일자', 'RECEIPT', 40, 'Y'),
('expense_date', '결제일', 'RECEIPT', 50, 'Y'),
('expense_date', '승인일자', 'RECEIPT', 60, 'Y'),
('expense_date', '승인일', 'RECEIPT', 70, 'Y'),
('expense_date', '거래일자', 'RECEIPT', 80, 'Y'),
('expense_date', '거래일', 'RECEIPT', 90, 'Y'),
('expense_date', '매출일자', 'RECEIPT', 100, 'Y'),
('expense_date', '매출일', 'RECEIPT', 110, 'Y'),
('expense_date', '일자', 'RECEIPT', 120, 'Y'),
('expense_date', '날짜', 'RECEIPT', 130, 'Y'),

('vendor_name', '사용처', 'RECEIPT', 10, 'Y'),
('vendor_name', '거래처', 'RECEIPT', 20, 'Y'),
('vendor_name', '거래처명', 'RECEIPT', 30, 'Y'),
('vendor_name', '가맹점', 'RECEIPT', 40, 'Y'),
('vendor_name', '가맹점명', 'RECEIPT', 50, 'Y'),
('vendor_name', '매장명', 'RECEIPT', 60, 'Y'),
('vendor_name', '상호', 'RECEIPT', 70, 'Y'),
('vendor_name', '상호명', 'RECEIPT', 80, 'Y'),
('vendor_name', '업체명', 'RECEIPT', 90, 'Y'),
('vendor_name', '판매자', 'RECEIPT', 100, 'Y'),
('vendor_name', '구입처', 'RECEIPT', 110, 'Y'),
('vendor_name', '구매처', 'RECEIPT', 120, 'Y'),

('vendor_business_number', '사업자번호', 'RECEIPT', 10, 'Y'),
('vendor_business_number', '사업자등록번호', 'RECEIPT', 20, 'Y'),
('vendor_business_number', '등록번호', 'RECEIPT', 30, 'Y'),
('vendor_business_number', '사업자 No', 'RECEIPT', 40, 'Y'),
('vendor_business_number', '사업자 No.', 'RECEIPT', 50, 'Y'),
('vendor_business_number', '사업자등록 No', 'RECEIPT', 60, 'Y'),
('vendor_business_number', '사업자등록 No.', 'RECEIPT', 70, 'Y'),

('business_number', '사업자번호', 'RECEIPT', 80, 'Y'),
('business_number', '사업자등록번호', 'RECEIPT', 90, 'Y'),

('vendor_representative', '대표자', 'RECEIPT', 10, 'Y'),
('vendor_representative', '대표자명', 'RECEIPT', 20, 'Y'),
('vendor_representative', '대표', 'RECEIPT', 30, 'Y'),

('vendor_address', '주소', 'RECEIPT', 10, 'Y'),
('vendor_address', '사업장주소', 'RECEIPT', 20, 'Y'),
('vendor_address', '소재지', 'RECEIPT', 30, 'Y'),
('vendor_address', '가맹점주소', 'RECEIPT', 40, 'Y'),

('vendor_phone', '전화', 'RECEIPT', 10, 'Y'),
('vendor_phone', '전화번호', 'RECEIPT', 20, 'Y'),
('vendor_phone', 'TEL', 'RECEIPT', 30, 'Y'),
('vendor_phone', 'Tel', 'RECEIPT', 40, 'Y'),
('vendor_phone', '연락처', 'RECEIPT', 50, 'Y'),

('total_amount', '지출총액', 'RECEIPT', 10, 'Y'),
('total_amount', '총액', 'RECEIPT', 20, 'Y'),
('total_amount', '합계', 'RECEIPT', 30, 'Y'),
('total_amount', '합계금액', 'RECEIPT', 40, 'Y'),
('total_amount', '총합계', 'RECEIPT', 50, 'Y'),
('total_amount', '청구금액', 'RECEIPT', 60, 'Y'),
('total_amount', '영수금액', 'RECEIPT', 70, 'Y'),
('total_amount', '판매금액', 'RECEIPT', 80, 'Y'),
('total_amount', '매출금액', 'RECEIPT', 90, 'Y'),
('total_amount', '받을금액', 'RECEIPT', 100, 'Y'),

('paid_amount', '결제금액', 'RECEIPT', 10, 'Y'),
('paid_amount', '승인금액', 'RECEIPT', 20, 'Y'),
('paid_amount', '카드결제', 'RECEIPT', 30, 'Y'),
('paid_amount', '실결제금액', 'RECEIPT', 40, 'Y'),
('paid_amount', '결제액', 'RECEIPT', 50, 'Y'),
('paid_amount', '받은금액', 'RECEIPT', 60, 'Y'),

('supply_amount', '공급가액', 'RECEIPT', 10, 'Y'),
('supply_amount', '공급가', 'RECEIPT', 20, 'Y'),
('supply_amount', '과세공급가액', 'RECEIPT', 30, 'Y'),
('supply_amount', '세전금액', 'RECEIPT', 40, 'Y'),
('supply_amount', '순매출', 'RECEIPT', 50, 'Y'),

('tax_amount', '부가세', 'RECEIPT', 10, 'Y'),
('tax_amount', '부가가치세', 'RECEIPT', 20, 'Y'),
('tax_amount', '세액', 'RECEIPT', 30, 'Y'),
('tax_amount', 'VAT', 'RECEIPT', 40, 'Y'),
('tax_amount', 'vat', 'RECEIPT', 50, 'Y'),

('taxable_amount', '과세', 'RECEIPT', 10, 'Y'),
('taxable_amount', '과세금액', 'RECEIPT', 20, 'Y'),
('taxable_amount', '과세매출', 'RECEIPT', 30, 'Y'),

('tax_free_amount', '면세', 'RECEIPT', 10, 'Y'),
('tax_free_amount', '면세금액', 'RECEIPT', 20, 'Y'),
('tax_free_amount', '면세매출', 'RECEIPT', 30, 'Y'),

('discount_amount', '할인', 'RECEIPT', 10, 'Y'),
('discount_amount', '할인금액', 'RECEIPT', 20, 'Y'),
('discount_amount', '에누리', 'RECEIPT', 30, 'Y'),

('payment_method', '결제수단', 'RECEIPT', 10, 'Y'),
('payment_method', '결제방법', 'RECEIPT', 20, 'Y'),
('payment_method', '지불수단', 'RECEIPT', 30, 'Y'),
('payment_method', '지급수단', 'RECEIPT', 40, 'Y'),
('payment_method', '카드', 'RECEIPT', 50, 'Y'),
('payment_method', '현금', 'RECEIPT', 60, 'Y'),
('payment_method', '간편결제', 'RECEIPT', 70, 'Y'),

('card_company', '카드사', 'RECEIPT', 10, 'Y'),
('card_company', '카드회사', 'RECEIPT', 20, 'Y'),
('card_company', '매입사', 'RECEIPT', 30, 'Y'),
('card_company', '발급사', 'RECEIPT', 40, 'Y'),

('card_number_masked', '카드번호', 'RECEIPT', 10, 'Y'),
('card_number_masked', '카드 No', 'RECEIPT', 20, 'Y'),
('card_number_masked', '카드 No.', 'RECEIPT', 30, 'Y'),
('card_number_masked', '카드회원번호', 'RECEIPT', 40, 'Y'),

('approval_number', '승인번호', 'RECEIPT', 10, 'Y'),
('approval_number', '카드승인번호', 'RECEIPT', 20, 'Y'),
('approval_number', '승인 No', 'RECEIPT', 30, 'Y'),
('approval_number', '승인 No.', 'RECEIPT', 40, 'Y'),
('approval_number', '승인NO', 'RECEIPT', 50, 'Y'),
('approval_number', '거래승인번호', 'RECEIPT', 60, 'Y'),

('approval_time', '승인시각', 'RECEIPT', 10, 'Y'),
('approval_time', '승인시간', 'RECEIPT', 20, 'Y'),
('approval_time', '거래시간', 'RECEIPT', 30, 'Y'),
('approval_time', '결제시간', 'RECEIPT', 40, 'Y'),

('installment_months', '할부', 'RECEIPT', 10, 'Y'),
('installment_months', '할부개월', 'RECEIPT', 20, 'Y'),
('installment_months', '일시불', 'RECEIPT', 30, 'Y'),

('receipt_type', '영수증구분', 'RECEIPT', 10, 'Y'),
('receipt_type', '영수증종류', 'RECEIPT', 20, 'Y'),
('receipt_type', '카드영수증', 'RECEIPT', 30, 'Y'),
('receipt_type', '현금영수증', 'RECEIPT', 40, 'Y'),

('cash_receipt_number', '현금영수증번호', 'RECEIPT', 10, 'Y'),
('cash_receipt_number', '현금승인번호', 'RECEIPT', 20, 'Y'),

('line_no', '번호', 'RECEIPT', 10, 'Y'),
('line_no', '순번', 'RECEIPT', 20, 'Y'),
('line_no', 'No', 'RECEIPT', 30, 'Y'),
('line_no', 'NO', 'RECEIPT', 40, 'Y'),

('item_name', '품목명', 'RECEIPT', 10, 'Y'),
('item_name', '상품명', 'RECEIPT', 20, 'Y'),
('item_name', '제품명', 'RECEIPT', 30, 'Y'),
('item_name', '메뉴명', 'RECEIPT', 40, 'Y'),
('item_name', '자재명', 'RECEIPT', 50, 'Y'),
('item_name', '내역', 'RECEIPT', 60, 'Y'),
('item_name', '구매품목', 'RECEIPT', 70, 'Y'),

('item_spec', '규격', 'RECEIPT', 10, 'Y'),
('item_spec', '모델', 'RECEIPT', 20, 'Y'),
('item_spec', '사양', 'RECEIPT', 30, 'Y'),

('unit', '단위', 'RECEIPT', 10, 'Y'),
('unit', 'EA', 'RECEIPT', 20, 'Y'),
('unit', '개', 'RECEIPT', 30, 'Y'),
('unit', '박스', 'RECEIPT', 40, 'Y'),

('quantity', '수량', 'RECEIPT', 10, 'Y'),
('quantity', 'Qty', 'RECEIPT', 20, 'Y'),
('quantity', 'QTY', 'RECEIPT', 30, 'Y'),
('quantity', '구매수량', 'RECEIPT', 40, 'Y'),

('unit_price', '단가', 'RECEIPT', 10, 'Y'),
('unit_price', '판매단가', 'RECEIPT', 20, 'Y'),
('unit_price', '구매단가', 'RECEIPT', 30, 'Y'),

('amount', '금액', 'RECEIPT', 10, 'Y'),
('amount', '판매금액', 'RECEIPT', 20, 'Y'),
('amount', '구매금액', 'RECEIPT', 30, 'Y'),
('amount', '품목금액', 'RECEIPT', 40, 'Y'),
('amount', '라인금액', 'RECEIPT', 50, 'Y'),

('description', '적요', 'RECEIPT', 10, 'Y'),
('description', '내용', 'RECEIPT', 20, 'Y'),
('description', '사용내역', 'RECEIPT', 30, 'Y'),
('description', '품목설명', 'RECEIPT', 40, 'Y'),
('description', '비용내용', 'RECEIPT', 50, 'Y'),

('note', '비고', 'RECEIPT', 10, 'Y'),
('note', '메모', 'RECEIPT', 20, 'Y'),
('note', '특이사항', 'RECEIPT', 30, 'Y'),
('note', '검토의견', 'RECEIPT', 40, 'Y'),

('expense_category_name', '항목', 'RECEIPT', 10, 'Y'),
('expense_category_name', '경비항목', 'RECEIPT', 20, 'Y'),
('expense_category_name', '경비분류', 'RECEIPT', 30, 'Y'),
('expense_category_name', '분류', 'RECEIPT', 40, 'Y'),
('expense_category_name', '계정구분', 'RECEIPT', 50, 'Y'),

('account_name', '계정과목', 'RECEIPT', 10, 'Y'),
('account_name', '계정과목명', 'RECEIPT', 20, 'Y'),
('account_name', '회계계정', 'RECEIPT', 30, 'Y');


-- =========================================================
-- 6-2. document_type_fields
-- =========================================================

CREATE TABLE document_type_fields (
  id INT AUTO_INCREMENT PRIMARY KEY,

  document_type VARCHAR(50) NOT NULL,
  field_key VARCHAR(100) NOT NULL,

  field_group ENUM(
    'BASIC', 'VENDOR', 'DATE', 'ITEM', 'AMOUNT', 'PAYMENT',
    'ACCOUNT', 'WORK', 'DELIVERY', 'INSPECTION', 'SYSTEM', 'ETC'
  ) NOT NULL DEFAULT 'ETC',

  required_yn CHAR(1) NOT NULL DEFAULT 'N',
  default_visible_yn CHAR(1) NOT NULL DEFAULT 'Y',
  advanced_yn CHAR(1) NOT NULL DEFAULT 'N',

  sort_order INT NOT NULL DEFAULT 0,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_document_type_fields (document_type, field_key),
  KEY idx_document_type_fields_doc_type (document_type),
  KEY idx_document_type_fields_field_key (field_key),
  KEY idx_document_type_fields_group (field_group),
  KEY idx_document_type_fields_visible (default_visible_yn),

  CONSTRAINT fk_document_type_fields_standard_field
    FOREIGN KEY (field_key) REFERENCES standard_fields(field_key)
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- 1. 영수증 (RECEIPT)
INSERT INTO document_type_fields
(document_type, field_key, field_group, required_yn, default_visible_yn, advanced_yn, sort_order)
VALUES
('RECEIPT', 'department_name', 'BASIC', 'N', 'Y', 'N', 10),
('RECEIPT', 'site_name', 'BASIC', 'N', 'Y', 'N', 20),
('RECEIPT', 'user_name', 'BASIC', 'N', 'Y', 'N', 30),
('RECEIPT', 'expense_title', 'BASIC', 'N', 'Y', 'N', 40),
('RECEIPT', 'expense_date', 'DATE', 'Y', 'Y', 'N', 100),
('RECEIPT', 'vendor_name', 'VENDOR', 'Y', 'Y', 'N', 110),
('RECEIPT', 'vendor_business_number', 'VENDOR', 'N', 'Y', 'Y', 120),
('RECEIPT', 'expense_category_name', 'ACCOUNT', 'N', 'Y', 'N', 130),
('RECEIPT', 'expense_category_code', 'ACCOUNT', 'N', 'N', 'Y', 131),
('RECEIPT', 'account_name', 'ACCOUNT', 'N', 'N', 'Y', 132),
('RECEIPT', 'account_code', 'ACCOUNT', 'N', 'N', 'Y', 133),
('RECEIPT', 'line_no', 'ITEM', 'N', 'Y', 'N', 200),
('RECEIPT', 'item_name', 'ITEM', 'N', 'Y', 'N', 210),
('RECEIPT', 'description', 'ITEM', 'N', 'Y', 'N', 220),
('RECEIPT', 'quantity', 'ITEM', 'N', 'N', 'Y', 230),
('RECEIPT', 'unit_price', 'ITEM', 'N', 'N', 'Y', 240),
('RECEIPT', 'amount', 'ITEM', 'Y', 'Y', 'N', 250),
('RECEIPT', 'supply_amount', 'AMOUNT', 'N', 'Y', 'Y', 300),
('RECEIPT', 'tax_amount', 'AMOUNT', 'N', 'Y', 'Y', 310),
('RECEIPT', 'total_amount', 'AMOUNT', 'Y', 'Y', 'N', 320),
('RECEIPT', 'paid_amount', 'AMOUNT', 'N', 'Y', 'Y', 330),
('RECEIPT', 'payment_method', 'PAYMENT', 'N', 'Y', 'N', 400),
('RECEIPT', 'card_company', 'PAYMENT', 'N', 'N', 'Y', 410),
('RECEIPT', 'card_number_masked', 'PAYMENT', 'N', 'N', 'Y', 420),
('RECEIPT', 'approval_number', 'PAYMENT', 'N', 'Y', 'Y', 430),
('RECEIPT', 'approval_time', 'PAYMENT', 'N', 'N', 'Y', 440),
('RECEIPT', 'note', 'ETC', 'N', 'Y', 'N', 500);

-- 2. 자재검수증 (MATERIAL_INSPECTION)
INSERT INTO document_type_fields
(document_type, field_key, field_group, required_yn, default_visible_yn, advanced_yn, sort_order)
VALUES
('MATERIAL_INSPECTION', 'department_name', 'BASIC', 'N', 'Y', 'N', 10),
('MATERIAL_INSPECTION', 'site_name', 'BASIC', 'Y', 'Y', 'N', 20),
('MATERIAL_INSPECTION', 'user_name', 'BASIC', 'N', 'Y', 'N', 30),
('MATERIAL_INSPECTION', 'document_title', 'BASIC', 'N', 'Y', 'N', 40),
('MATERIAL_INSPECTION', 'inspection_no', 'BASIC', 'N', 'Y', 'Y', 50),
('MATERIAL_INSPECTION', 'inspection_date', 'DATE', 'Y', 'Y', 'N', 100),
('MATERIAL_INSPECTION', 'delivery_date', 'DATE', 'N', 'Y', 'Y', 110),
('MATERIAL_INSPECTION', 'created_date', 'DATE', 'N', 'Y', 'Y', 120),
('MATERIAL_INSPECTION', 'vendor_name', 'VENDOR', 'N', 'Y', 'N', 200),
('MATERIAL_INSPECTION', 'vendor_business_number', 'VENDOR', 'N', 'N', 'Y', 210),
('MATERIAL_INSPECTION', 'order_no', 'DELIVERY', 'N', 'Y', 'Y', 300),
('MATERIAL_INSPECTION', 'purchase_order_no', 'DELIVERY', 'N', 'Y', 'Y', 310),
('MATERIAL_INSPECTION', 'delivery_no', 'DELIVERY', 'N', 'Y', 'Y', 320),
('MATERIAL_INSPECTION', 'delivery_location', 'DELIVERY', 'N', 'Y', 'Y', 330),
('MATERIAL_INSPECTION', 'warehouse_name', 'DELIVERY', 'N', 'Y', 'Y', 340),
('MATERIAL_INSPECTION', 'inspection_result', 'INSPECTION', 'N', 'Y', 'N', 400),
('MATERIAL_INSPECTION', 'accepted_quantity', 'INSPECTION', 'N', 'Y', 'N', 410),
('MATERIAL_INSPECTION', 'defect_quantity', 'INSPECTION', 'N', 'Y', 'N', 420),
('MATERIAL_INSPECTION', 'line_no', 'ITEM', 'N', 'Y', 'N', 500),
('MATERIAL_INSPECTION', 'item_code', 'ITEM', 'N', 'Y', 'Y', 510),
('MATERIAL_INSPECTION', 'item_name', 'ITEM', 'Y', 'Y', 'N', 520),
('MATERIAL_INSPECTION', 'item_spec', 'ITEM', 'N', 'Y', 'N', 530),
('MATERIAL_INSPECTION', 'unit', 'ITEM', 'N', 'Y', 'N', 540),
('MATERIAL_INSPECTION', 'quantity', 'ITEM', 'Y', 'Y', 'N', 550),
('MATERIAL_INSPECTION', 'material_name', 'ITEM', 'N', 'Y', 'Y', 560),
('MATERIAL_INSPECTION', 'material_spec', 'ITEM', 'N', 'Y', 'Y', 570),
('MATERIAL_INSPECTION', 'material_quantity', 'ITEM', 'N', 'Y', 'Y', 580),
('MATERIAL_INSPECTION', 'unit_price', 'AMOUNT', 'N', 'N', 'Y', 600),
('MATERIAL_INSPECTION', 'amount', 'AMOUNT', 'N', 'N', 'Y', 610),
('MATERIAL_INSPECTION', 'total_amount', 'AMOUNT', 'N', 'N', 'Y', 620),
('MATERIAL_INSPECTION', 'description', 'ETC', 'N', 'Y', 'N', 700),
('MATERIAL_INSPECTION', 'note', 'ETC', 'N', 'Y', 'N', 710);

-- 3. 거래명세서 (TRANSACTION_STATEMENT)
INSERT INTO document_type_fields
(document_type, field_key, field_group, required_yn, default_visible_yn, advanced_yn, sort_order)
VALUES
('TRANSACTION_STATEMENT', 'department_name', 'BASIC', 'N', 'Y', 'N', 10),
('TRANSACTION_STATEMENT', 'site_name', 'BASIC', 'N', 'Y', 'N', 20),
('TRANSACTION_STATEMENT', 'user_name', 'BASIC', 'N', 'Y', 'N', 30),
('TRANSACTION_STATEMENT', 'document_title', 'BASIC', 'N', 'Y', 'N', 40),
('TRANSACTION_STATEMENT', 'document_no', 'BASIC', 'N', 'Y', 'Y', 50),
('TRANSACTION_STATEMENT', 'transaction_date', 'DATE', 'Y', 'Y', 'N', 100),
('TRANSACTION_STATEMENT', 'issue_date', 'DATE', 'N', 'Y', 'Y', 110),
('TRANSACTION_STATEMENT', 'created_date', 'DATE', 'N', 'Y', 'Y', 120),
('TRANSACTION_STATEMENT', 'vendor_name', 'VENDOR', 'Y', 'Y', 'N', 200),
('TRANSACTION_STATEMENT', 'vendor_business_number', 'VENDOR', 'N', 'Y', 'Y', 210),
('TRANSACTION_STATEMENT', 'vendor_representative', 'VENDOR', 'N', 'N', 'Y', 220),
('TRANSACTION_STATEMENT', 'vendor_address', 'VENDOR', 'N', 'N', 'Y', 230),
('TRANSACTION_STATEMENT', 'vendor_phone', 'VENDOR', 'N', 'N', 'Y', 240),
('TRANSACTION_STATEMENT', 'line_no', 'ITEM', 'N', 'Y', 'N', 300),
('TRANSACTION_STATEMENT', 'item_code', 'ITEM', 'N', 'Y', 'Y', 310),
('TRANSACTION_STATEMENT', 'item_name', 'ITEM', 'Y', 'Y', 'N', 320),
('TRANSACTION_STATEMENT', 'item_spec', 'ITEM', 'N', 'Y', 'N', 330),
('TRANSACTION_STATEMENT', 'unit', 'ITEM', 'N', 'Y', 'N', 340),
('TRANSACTION_STATEMENT', 'quantity', 'ITEM', 'Y', 'Y', 'N', 350),
('TRANSACTION_STATEMENT', 'unit_price', 'ITEM', 'N', 'Y', 'N', 360),
('TRANSACTION_STATEMENT', 'amount', 'ITEM', 'Y', 'Y', 'N', 370),
('TRANSACTION_STATEMENT', 'description', 'ITEM', 'N', 'Y', 'N', 380),
('TRANSACTION_STATEMENT', 'supply_amount', 'AMOUNT', 'N', 'Y', 'N', 400),
('TRANSACTION_STATEMENT', 'tax_amount', 'AMOUNT', 'N', 'Y', 'N', 410),
('TRANSACTION_STATEMENT', 'total_amount', 'AMOUNT', 'Y', 'Y', 'N', 420),
('TRANSACTION_STATEMENT', 'taxable_amount', 'AMOUNT', 'N', 'N', 'Y', 430),
('TRANSACTION_STATEMENT', 'tax_free_amount', 'AMOUNT', 'N', 'N', 'Y', 440),
('TRANSACTION_STATEMENT', 'payment_method', 'PAYMENT', 'N', 'N', 'Y', 500),
('TRANSACTION_STATEMENT', 'due_date', 'PAYMENT', 'N', 'N', 'Y', 510),
('TRANSACTION_STATEMENT', 'note', 'ETC', 'N', 'Y', 'N', 600);

-- 4. 납품서 (DELIVERY_NOTE)
INSERT INTO document_type_fields
(document_type, field_key, field_group, required_yn, default_visible_yn, advanced_yn, sort_order)
VALUES
('DELIVERY_NOTE', 'department_name', 'BASIC', 'N', 'Y', 'N', 10),
('DELIVERY_NOTE', 'site_name', 'BASIC', 'Y', 'Y', 'N', 20),
('DELIVERY_NOTE', 'user_name', 'BASIC', 'N', 'Y', 'N', 30),
('DELIVERY_NOTE', 'document_title', 'BASIC', 'N', 'Y', 'N', 40),
('DELIVERY_NOTE', 'delivery_no', 'BASIC', 'N', 'Y', 'N', 50),
('DELIVERY_NOTE', 'delivery_date', 'DATE', 'Y', 'Y', 'N', 100),
('DELIVERY_NOTE', 'created_date', 'DATE', 'N', 'Y', 'Y', 110),
('DELIVERY_NOTE', 'due_date', 'DATE', 'N', 'N', 'Y', 120),
('DELIVERY_NOTE', 'vendor_name', 'VENDOR', 'Y', 'Y', 'N', 200),
('DELIVERY_NOTE', 'vendor_business_number', 'VENDOR', 'N', 'Y', 'Y', 210),
('DELIVERY_NOTE', 'vendor_phone', 'VENDOR', 'N', 'N', 'Y', 220),
('DELIVERY_NOTE', 'order_no', 'DELIVERY', 'N', 'Y', 'Y', 300),
('DELIVERY_NOTE', 'purchase_order_no', 'DELIVERY', 'N', 'Y', 'Y', 310),
('DELIVERY_NOTE', 'delivery_location', 'DELIVERY', 'N', 'Y', 'N', 320),
('DELIVERY_NOTE', 'warehouse_name', 'DELIVERY', 'N', 'Y', 'Y', 330),
('DELIVERY_NOTE', 'line_no', 'ITEM', 'N', 'Y', 'N', 400),
('DELIVERY_NOTE', 'item_code', 'ITEM', 'N', 'Y', 'Y', 410),
('DELIVERY_NOTE', 'item_name', 'ITEM', 'Y', 'Y', 'N', 420),
('DELIVERY_NOTE', 'item_spec', 'ITEM', 'N', 'Y', 'N', 430),
('DELIVERY_NOTE', 'unit', 'ITEM', 'N', 'Y', 'N', 440),
('DELIVERY_NOTE', 'quantity', 'ITEM', 'Y', 'Y', 'N', 450),
('DELIVERY_NOTE', 'description', 'ITEM', 'N', 'Y', 'N', 460),
('DELIVERY_NOTE', 'unit_price', 'AMOUNT', 'N', 'N', 'Y', 500),
('DELIVERY_NOTE', 'amount', 'AMOUNT', 'N', 'N', 'Y', 510),
('DELIVERY_NOTE', 'total_amount', 'AMOUNT', 'N', 'N', 'Y', 520),
('DELIVERY_NOTE', 'note', 'ETC', 'N', 'Y', 'N', 600);

-- 5. 작업일보 (DAILY_REPORT)
INSERT INTO document_type_fields
(document_type, field_key, field_group, required_yn, default_visible_yn, advanced_yn, sort_order)
VALUES
('DAILY_REPORT', 'department_name', 'BASIC', 'N', 'Y', 'N', 10),
('DAILY_REPORT', 'site_name', 'BASIC', 'Y', 'Y', 'N', 20),
('DAILY_REPORT', 'user_name', 'BASIC', 'N', 'Y', 'N', 30),
('DAILY_REPORT', 'document_title', 'BASIC', 'N', 'Y', 'N', 40),
('DAILY_REPORT', 'document_no', 'BASIC', 'N', 'Y', 'Y', 50),
('DAILY_REPORT', 'work_date', 'DATE', 'Y', 'Y', 'N', 100),
('DAILY_REPORT', 'created_date', 'DATE', 'N', 'Y', 'Y', 110),
('DAILY_REPORT', 'period_start_date', 'DATE', 'N', 'N', 'Y', 120),
('DAILY_REPORT', 'period_end_date', 'DATE', 'N', 'N', 'Y', 130),
('DAILY_REPORT', 'work_type', 'WORK', 'N', 'Y', 'N', 200),
('DAILY_REPORT', 'work_content', 'WORK', 'Y', 'Y', 'N', 210),
('DAILY_REPORT', 'worker_count', 'WORK', 'N', 'Y', 'N', 220),
('DAILY_REPORT', 'equipment_name', 'WORK', 'N', 'Y', 'N', 230),
('DAILY_REPORT', 'equipment_count', 'WORK', 'N', 'Y', 'N', 240),
('DAILY_REPORT', 'weather', 'WORK', 'N', 'Y', 'N', 250),
('DAILY_REPORT', 'progress_rate', 'WORK', 'N', 'Y', 'Y', 260),
('DAILY_REPORT', 'line_no', 'ITEM', 'N', 'Y', 'N', 300),
('DAILY_REPORT', 'material_name', 'ITEM', 'N', 'Y', 'N', 310),
('DAILY_REPORT', 'material_spec', 'ITEM', 'N', 'Y', 'N', 320),
('DAILY_REPORT', 'material_quantity', 'ITEM', 'N', 'Y', 'N', 330),
('DAILY_REPORT', 'unit', 'ITEM', 'N', 'Y', 'N', 340),
('DAILY_REPORT', 'description', 'ITEM', 'N', 'Y', 'N', 350),
('DAILY_REPORT', 'note', 'ETC', 'N', 'Y', 'N', 500);

-- 6. 품목형 영수증 (ITEM_RECEIPT)
INSERT INTO document_type_fields
(document_type, field_key, field_group, required_yn, default_visible_yn, advanced_yn, sort_order)
VALUES
('ITEM_RECEIPT', 'expense_date', 'DATE', 'Y', 'Y', 'N', 100),
('ITEM_RECEIPT', 'vendor_name', 'VENDOR', 'Y', 'Y', 'N', 110),
('ITEM_RECEIPT', 'item_name', 'ITEM', 'N', 'Y', 'N', 200),
('ITEM_RECEIPT', 'quantity', 'ITEM', 'N', 'Y', 'N', 210),
('ITEM_RECEIPT', 'unit_price', 'ITEM', 'N', 'Y', 'N', 220),
('ITEM_RECEIPT', 'amount', 'ITEM', 'Y', 'Y', 'N', 230),
('ITEM_RECEIPT', 'supply_amount', 'AMOUNT', 'N', 'Y', 'Y', 300),
('ITEM_RECEIPT', 'tax_amount', 'AMOUNT', 'N', 'Y', 'Y', 310),
('ITEM_RECEIPT', 'total_amount', 'AMOUNT', 'Y', 'Y', 'N', 320),
('ITEM_RECEIPT', 'paid_amount', 'AMOUNT', 'N', 'Y', 'Y', 330),
('ITEM_RECEIPT', 'discount_amount', 'AMOUNT', 'N', 'Y', 'Y', 340),
('ITEM_RECEIPT', 'payment_method', 'PAYMENT', 'N', 'Y', 'N', 400),
('ITEM_RECEIPT', 'approval_number', 'PAYMENT', 'N', 'Y', 'Y', 410);

-- 7. 교통 영수증 (TRANSPORT_RECEIPT)
INSERT INTO document_type_fields
(document_type, field_key, field_group, required_yn, default_visible_yn, advanced_yn, sort_order)
VALUES
('TRANSPORT_RECEIPT', 'expense_date', 'DATE', 'Y', 'Y', 'N', 100),
('TRANSPORT_RECEIPT', 'vendor_name', 'VENDOR', 'Y', 'Y', 'N', 110),
('TRANSPORT_RECEIPT', 'expense_category_name', 'ACCOUNT', 'Y', 'Y', 'N', 120),
('TRANSPORT_RECEIPT', 'transport_type', 'ETC', 'N', 'Y', 'N', 200),
('TRANSPORT_RECEIPT', 'departure_place', 'ETC', 'N', 'Y', 'N', 210),
('TRANSPORT_RECEIPT', 'arrival_place', 'ETC', 'N', 'Y', 'N', 220),
('TRANSPORT_RECEIPT', 'boarding_datetime', 'DATE', 'N', 'Y', 'N', 230),
('TRANSPORT_RECEIPT', 'seat_no', 'ETC', 'N', 'Y', 'N', 240),
('TRANSPORT_RECEIPT', 'ticket_no', 'ETC', 'N', 'Y', 'N', 250),
('TRANSPORT_RECEIPT', 'total_amount', 'AMOUNT', 'Y', 'Y', 'N', 300),
('TRANSPORT_RECEIPT', 'payment_method', 'PAYMENT', 'N', 'Y', 'N', 400);

-- 8. 카드 전표 (CARD_RECEIPT)
INSERT INTO document_type_fields
(document_type, field_key, field_group, required_yn, default_visible_yn, advanced_yn, sort_order)
VALUES
('CARD_RECEIPT', 'expense_date', 'DATE', 'Y', 'Y', 'N', 100),
('CARD_RECEIPT', 'vendor_name', 'VENDOR', 'Y', 'Y', 'N', 110),
('CARD_RECEIPT', 'total_amount', 'AMOUNT', 'Y', 'Y', 'N', 300),
('CARD_RECEIPT', 'paid_amount', 'AMOUNT', 'N', 'Y', 'Y', 310),
('CARD_RECEIPT', 'payment_method', 'PAYMENT', 'Y', 'Y', 'N', 400),
('CARD_RECEIPT', 'card_company', 'PAYMENT', 'N', 'Y', 'Y', 410),
('CARD_RECEIPT', 'card_number_masked', 'PAYMENT', 'N', 'Y', 'Y', 420),
('CARD_RECEIPT', 'approval_number', 'PAYMENT', 'Y', 'Y', 'N', 430);


-- =========================================================
-- 7. templates
-- =========================================================

CREATE TABLE templates (
  id INT AUTO_INCREMENT PRIMARY KEY,

  template_group_id INT,
  template_name VARCHAR(150) NOT NULL,
  name VARCHAR(150) NULL,
  description VARCHAR(500),

  version INT NOT NULL DEFAULT 1,

  original_file_name VARCHAR(255),
  stored_file_name VARCHAR(255),
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(20) DEFAULT 'xlsx',

  status ENUM('DRAFT', 'LOCKED', 'ACTIVE', 'INACTIVE', 'ARCHIVED') DEFAULT 'DRAFT',

  is_active BOOLEAN DEFAULT TRUE,
  is_locked BOOLEAN DEFAULT FALSE,

  created_by INT,
  locked_by INT,
  activated_by INT,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  locked_at DATETIME,
  activated_at DATETIME,

  KEY idx_templates_status (status),
  KEY idx_templates_active (is_active),
  KEY idx_templates_created_by (created_by),

  CONSTRAINT fk_templates_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_templates_locked_by
    FOREIGN KEY (locked_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_templates_activated_by
    FOREIGN KEY (activated_by) REFERENCES users(id) ON DELETE SET NULL
);


-- =========================================================
-- 8. template_mappings
-- =========================================================

CREATE TABLE template_mappings (
  id INT AUTO_INCREMENT PRIMARY KEY,

  template_id INT NOT NULL,
  standard_field_id INT,

  field_key VARCHAR(100) NOT NULL,
  field_label VARCHAR(100) NOT NULL,

  mapping_type ENUM('SINGLE_CELL', 'REPEAT_COLUMN') NOT NULL,
  sheet_name VARCHAR(100) NOT NULL,

  cell_address VARCHAR(20),
  column_letter VARCHAR(10),
  start_row INT,
  max_rows INT,

  is_required BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  is_locked BOOLEAN DEFAULT FALSE,

  created_by INT,
  locked_by INT,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  locked_at DATETIME,

  KEY idx_template_mappings_template_id (template_id),
  KEY idx_template_mappings_standard_field_id (standard_field_id),
  KEY idx_template_mappings_field_key (field_key),
  KEY idx_template_mappings_mapping_type (mapping_type),

  CONSTRAINT fk_template_mappings_template
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  CONSTRAINT fk_template_mappings_standard_field
    FOREIGN KEY (standard_field_id) REFERENCES standard_fields(id) ON DELETE SET NULL,
  CONSTRAINT fk_template_mappings_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_template_mappings_locked_by
    FOREIGN KEY (locked_by) REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT uk_template_field_mapping
    UNIQUE (template_id, field_key, mapping_type)
);


-- =========================================================
-- 9. validation_rules
-- =========================================================

CREATE TABLE validation_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,

  rule_code VARCHAR(100) NOT NULL UNIQUE,
  rule_name VARCHAR(150) NOT NULL,

  rule_type ENUM(
    'REQUIRED', 'NUMBER_FORMAT', 'AMOUNT_CHECK', 'DUPLICATE_CHECK',
    'CONFIDENCE_CHECK', 'FILE_CHECK', 'CATEGORY_CHECK', 'ITEM_CHECK', 'FORMAT_CHECK'
  ) NOT NULL,

  standard_field_id INT,
  condition_json JSON,

  severity ENUM('INFO', 'WARNING', 'ERROR') DEFAULT 'ERROR',
  is_active BOOLEAN DEFAULT TRUE,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_validation_rules_standard_field
    FOREIGN KEY (standard_field_id) REFERENCES standard_fields(id) ON DELETE SET NULL
);

INSERT INTO validation_rules
(rule_code, rule_name, rule_type, standard_field_id, condition_json, severity, is_active)
VALUES
('REQ_SITE_NAME', '현장명 필수값 검증', 'REQUIRED', (SELECT id FROM standard_fields WHERE field_key = 'site_name'), JSON_OBJECT('required', true), 'ERROR', TRUE),
('REQ_DEPARTMENT_NAME', '부서명 필수값 검증', 'REQUIRED', (SELECT id FROM standard_fields WHERE field_key = 'department_name'), JSON_OBJECT('required', true), 'ERROR', TRUE),
('REQ_USER_NAME', '사용자 필수값 검증', 'REQUIRED', (SELECT id FROM standard_fields WHERE field_key = 'user_name'), JSON_OBJECT('required', true), 'ERROR', TRUE),
('REQ_EXPENSE_DATE', '사용일자 필수값 검증', 'REQUIRED', (SELECT id FROM standard_fields WHERE field_key = 'expense_date'), JSON_OBJECT('required', true), 'ERROR', TRUE),
('REQ_VENDOR_NAME', '사용처 필수값 검증', 'REQUIRED', (SELECT id FROM standard_fields WHERE field_key = 'vendor_name'), JSON_OBJECT('required', true), 'ERROR', TRUE),
('REQ_EXPENSE_CATEGORY_NAME', '항목 필수값 검증', 'REQUIRED', (SELECT id FROM standard_fields WHERE field_key = 'expense_category_name'), JSON_OBJECT('required', true), 'ERROR', TRUE),
('REQ_AMOUNT', '금액 필수값 검증', 'REQUIRED', (SELECT id FROM standard_fields WHERE field_key = 'amount'), JSON_OBJECT('required', true), 'ERROR', TRUE),
('REQ_TOTAL_AMOUNT', '지출총액 필수값 검증', 'REQUIRED', (SELECT id FROM standard_fields WHERE field_key = 'total_amount'), JSON_OBJECT('required', true), 'ERROR', TRUE),
('AMOUNT_NUMBER', '금액 숫자 형식 검증', 'NUMBER_FORMAT', (SELECT id FROM standard_fields WHERE field_key = 'amount'), JSON_OBJECT('allow_comma', true, 'min', 0), 'ERROR', TRUE),
('TOTAL_AMOUNT_NUMBER', '지출총액 숫자 형식 검증', 'NUMBER_FORMAT', (SELECT id FROM standard_fields WHERE field_key = 'total_amount'), JSON_OBJECT('allow_comma', true, 'min', 0), 'ERROR', TRUE),
('SUPPLY_TAX_TOTAL_CHECK', '공급가액+부가세=지출총액 검증', 'AMOUNT_CHECK', (SELECT id FROM standard_fields WHERE field_key = 'total_amount'), JSON_OBJECT('supply_field', 'supply_amount', 'tax_field', 'tax_amount', 'total_field', 'total_amount', 'tolerance', 10), 'WARNING', TRUE),
('ITEM_SUM_TOTAL_CHECK', '상세 품목 합계와 지출총액 검증', 'AMOUNT_CHECK', (SELECT id FROM standard_fields WHERE field_key = 'amount'), JSON_OBJECT('item_amount_field', 'amount', 'total_field', 'total_amount', 'tolerance', 100), 'WARNING', TRUE),
('DUPLICATE_RECEIPT', '중복 영수증 의심 검증', 'DUPLICATE_CHECK', NULL, JSON_OBJECT('keys', JSON_ARRAY('expense_date', 'vendor_name', 'total_amount')), 'WARNING', TRUE),
('LOW_CONFIDENCE', 'OCR/AI 신뢰도 검증', 'CONFIDENCE_CHECK', NULL, JSON_OBJECT('min_confidence', 0.80), 'WARNING', TRUE),
('VENDOR_BUSINESS_NUMBER_FORMAT', '사업자등록번호 형식 검증', 'FORMAT_CHECK', (SELECT id FROM standard_fields WHERE field_key = 'vendor_business_number'), JSON_OBJECT('regex', '^[0-9]{3}-?[0-9]{2}-?[0-9]{5}$'), 'WARNING', TRUE),
('ITEM_NON_ITEM_KEYWORD_CHECK', '품목명 정산/결제 키워드 혼입 검증', 'ITEM_CHECK', (SELECT id FROM standard_fields WHERE field_key = 'item_name'), JSON_OBJECT('exclude_keywords', JSON_ARRAY('합계', '총액', '부가세', '공급가액', '승인금액', '결제금액', '카드번호', '승인번호', '현금영수증', '포인트', '거스름돈')), 'ERROR', TRUE);


-- =========================================================
-- 10. expense_batches
-- =========================================================

CREATE TABLE expense_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,

  batch_no VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(150),

  submitter_id INT,
  department_id INT,
  site_id INT,
  site_name VARCHAR(100),
  template_id INT,

  document_type VARCHAR(50) DEFAULT 'RECEIPT',

  status VARCHAR(50) NOT NULL DEFAULT 'UPLOADED',

  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_expense_batches_submitter_id (submitter_id),
  KEY idx_expense_batches_department_id (department_id),
  KEY idx_expense_batches_site_id (site_id),
  KEY idx_expense_batches_template_id (template_id),
  KEY idx_expense_batches_status (status),

  CONSTRAINT fk_expense_batches_submitter
    FOREIGN KEY (submitter_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_expense_batches_department
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  CONSTRAINT fk_expense_batches_site
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL,
  CONSTRAINT fk_expense_batches_template
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
);


-- =========================================================
-- 11. upload_batches
-- =========================================================

CREATE TABLE upload_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,

  batch_no VARCHAR(100) NOT NULL,

  submitter_id INT,
  template_id INT,
  department_id INT,
  site_id INT,
  site_name VARCHAR(100),

  title VARCHAR(150),
  document_type VARCHAR(50) DEFAULT 'RECEIPT',

  status VARCHAR(50) NOT NULL DEFAULT 'UPLOADED',

  total_file_count INT DEFAULT 0,
  processed_file_count INT DEFAULT 0,

  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_upload_batches_batch_no (batch_no),
  KEY idx_upload_batches_submitter_id (submitter_id),
  KEY idx_upload_batches_template_id (template_id),
  KEY idx_upload_batches_department_id (department_id),
  KEY idx_upload_batches_site_id (site_id),
  KEY idx_upload_batches_status (status),
  KEY idx_upload_batches_document_type (document_type),

  CONSTRAINT fk_upload_batches_submitter
    FOREIGN KEY (submitter_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_upload_batches_template
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL,
  CONSTRAINT fk_upload_batches_department
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  CONSTRAINT fk_upload_batches_site
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
);


-- =========================================================
-- 12. source_files
-- =========================================================

CREATE TABLE source_files (
  id INT AUTO_INCREMENT PRIMARY KEY,

  batch_id INT,
  upload_batch_id INT,
  template_id INT,

  uploader_id INT,
  uploaded_by INT,

  original_file_name VARCHAR(255) NOT NULL,
  stored_file_name VARCHAR(255),
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(30),
  mime_type VARCHAR(100),
  file_size BIGINT,

  document_type VARCHAR(50) DEFAULT 'RECEIPT',

  status VARCHAR(50) NOT NULL DEFAULT 'UPLOADED',

  ocr_text LONGTEXT,
  ai_raw_json JSON,
  confidence_score DECIMAL(5,2),
  error_message TEXT,

  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  completed_at DATETIME,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_source_files_batch_id (batch_id),
  KEY idx_source_files_upload_batch_id (upload_batch_id),
  KEY idx_source_files_template_id (template_id),
  KEY idx_source_files_uploader_id (uploader_id),
  KEY idx_source_files_uploaded_by (uploaded_by),
  KEY idx_source_files_status (status),
  KEY idx_source_files_document_type (document_type),

  CONSTRAINT fk_source_files_expense_batch
    FOREIGN KEY (batch_id) REFERENCES expense_batches(id) ON DELETE SET NULL,
  CONSTRAINT fk_source_files_upload_batch
    FOREIGN KEY (upload_batch_id) REFERENCES upload_batches(id) ON DELETE SET NULL,
  CONSTRAINT fk_source_files_template
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL,
  CONSTRAINT fk_source_files_uploader
    FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_source_files_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);


-- =========================================================
-- 13. extracted_values
-- =========================================================

CREATE TABLE extracted_values (
  id INT AUTO_INCREMENT PRIMARY KEY,

  source_file_id INT NOT NULL,
  standard_field_id INT,
  expense_category_id INT,

  field_key VARCHAR(100) NOT NULL,
  field_label VARCHAR(100),

  row_index INT,

  extracted_value TEXT,
  normalized_value TEXT,
  final_value TEXT,
  modified_value TEXT,

  confidence DECIMAL(5,2),
  confidence_score DECIMAL(5,2),

  extraction_source VARCHAR(50) NOT NULL DEFAULT 'AI',

  is_modified BOOLEAN DEFAULT FALSE,
  modified_by INT,
  modified_at DATETIME,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_extracted_values_source_file_id (source_file_id),
  KEY idx_extracted_values_standard_field_id (standard_field_id),
  KEY idx_extracted_values_expense_category_id (expense_category_id),
  KEY idx_extracted_values_field_key (field_key),
  KEY idx_extracted_values_row_index (row_index),

  CONSTRAINT fk_extracted_values_source_file
    FOREIGN KEY (source_file_id) REFERENCES source_files(id) ON DELETE CASCADE,
  CONSTRAINT fk_extracted_values_standard_field
    FOREIGN KEY (standard_field_id) REFERENCES standard_fields(id) ON DELETE SET NULL,
  CONSTRAINT fk_extracted_values_expense_category
    FOREIGN KEY (expense_category_id) REFERENCES expense_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_extracted_values_modified_by
    FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL
);


-- =========================================================
-- 14. validation_results
-- =========================================================

CREATE TABLE validation_results (
  id INT AUTO_INCREMENT PRIMARY KEY,

  source_file_id INT NOT NULL,
  extracted_value_id INT NULL,

  field_key VARCHAR(100) NULL,
  validation_type VARCHAR(100) NULL,
  rule_code VARCHAR(100) NULL,
  rule_name VARCHAR(255) NULL,

  result_status VARCHAR(50) NOT NULL DEFAULT 'NEED_REVIEW',
  status VARCHAR(50) NULL,

  message TEXT NULL,
  severity VARCHAR(30) NOT NULL DEFAULT 'WARNING',

  current_value TEXT NULL,
  expected_value TEXT NULL,

  is_resolved TINYINT(1) NOT NULL DEFAULT 0,
  resolved_by INT NULL,
  resolved_at DATETIME NULL,

  checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_validation_results_source_file_id (source_file_id),
  KEY idx_validation_results_extracted_value_id (extracted_value_id),
  KEY idx_validation_results_status (result_status),
  KEY idx_validation_results_rule_code (rule_code),

  CONSTRAINT fk_validation_results_source_file
    FOREIGN KEY (source_file_id) REFERENCES source_files(id) ON DELETE CASCADE,
  CONSTRAINT fk_validation_results_extracted_value
    FOREIGN KEY (extracted_value_id) REFERENCES extracted_values(id) ON DELETE SET NULL,
  CONSTRAINT fk_validation_results_resolved_by
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);


-- =========================================================
-- 15. supplement_requests
-- =========================================================

CREATE TABLE supplement_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,

  source_file_id INT NOT NULL,
  requested_by INT,
  submitter_id INT,

  status ENUM('REQUESTED', 'RESUBMITTED', 'COMPLETED', 'CANCELLED') DEFAULT 'REQUESTED',

  reason VARCHAR(500) NOT NULL,
  requested_fields JSON,
  response_message TEXT,

  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resubmitted_at DATETIME,
  completed_at DATETIME,

  KEY idx_supplement_requests_source_file_id (source_file_id),
  KEY idx_supplement_requests_requested_by (requested_by),
  KEY idx_supplement_requests_submitter_id (submitter_id),
  KEY idx_supplement_requests_status (status),

  CONSTRAINT fk_supplement_requests_source_file
    FOREIGN KEY (source_file_id) REFERENCES source_files(id) ON DELETE CASCADE,
  CONSTRAINT fk_supplement_requests_requested_by
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_supplement_requests_submitter
    FOREIGN KEY (submitter_id) REFERENCES users(id) ON DELETE SET NULL
);


-- =========================================================
-- 16. generated_documents
-- =========================================================

CREATE TABLE generated_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,

  batch_id INT,
  upload_batch_id INT,
  template_id INT,
  source_file_id INT NULL,

  file_name VARCHAR(255),
  document_name VARCHAR(255),
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(20) DEFAULT 'xlsx',

  status VARCHAR(50) NOT NULL DEFAULT 'DOWNLOADABLE',

  generated_by INT,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  downloaded_at DATETIME,
  download_count INT DEFAULT 0,

  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  KEY idx_generated_documents_batch_id (batch_id),
  KEY idx_generated_documents_upload_batch_id (upload_batch_id),
  KEY idx_generated_documents_template_id (template_id),
  KEY idx_generated_documents_source_file_id (source_file_id),
  KEY idx_generated_documents_generated_by (generated_by),
  KEY idx_generated_documents_status (status),

  CONSTRAINT fk_generated_documents_expense_batch
    FOREIGN KEY (batch_id) REFERENCES expense_batches(id) ON DELETE SET NULL,
  CONSTRAINT fk_generated_documents_upload_batch
    FOREIGN KEY (upload_batch_id) REFERENCES upload_batches(id) ON DELETE SET NULL,
  CONSTRAINT fk_generated_documents_template
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL,
  CONSTRAINT fk_generated_documents_source_file_id
    FOREIGN KEY (source_file_id) REFERENCES source_files(id) ON DELETE SET NULL,
  CONSTRAINT fk_generated_documents_generated_by
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
);


-- =========================================================
-- 17. audit_logs
-- =========================================================

CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,

  user_id INT,

  action_type VARCHAR(100),
  action VARCHAR(100),

  target_table VARCHAR(100),
  target_type VARCHAR(100),
  target_id INT,

  before_data JSON,
  after_data JSON,

  ip_address VARCHAR(50),
  user_agent VARCHAR(500),

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  KEY idx_audit_logs_user_id (user_id),
  KEY idx_audit_logs_action_type (action_type),
  KEY idx_audit_logs_action (action),
  KEY idx_audit_logs_target (target_table, target_id),

  CONSTRAINT fk_audit_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);


-- =========================================================
-- 18. document_types
-- =========================================================

CREATE TABLE document_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_type VARCHAR(50) NOT NULL UNIQUE,
  document_type_name VARCHAR(100) NOT NULL,
  parent_type VARCHAR(50) DEFAULT 'RECEIPT',
  description VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO document_types
(document_type, document_type_name, parent_type, description, is_active, sort_order)
VALUES
('ITEM_RECEIPT', '품목형 영수증', 'RECEIPT', '마트, 다이소, 편의점, 식당처럼 품목/단가/수량/금액이 있는 영수증', TRUE, 10),
('TRANSPORT_RECEIPT', '교통 영수증', 'RECEIPT', '코레일, KTX, 시외버스, 고속버스, 터미널, 택시 등 교통비 영수증', TRUE, 20),
('CARD_RECEIPT', '카드 매출전표', 'RECEIPT', '카드 승인번호, 승인금액, 가맹점 중심의 카드 전표', TRUE, 30),
('GENERIC_RECEIPT', '기타 영수증', 'RECEIPT', '유형 분류가 어려운 일반 영수증', TRUE, 90);


-- =========================================================
-- 19. document_type_rules
-- =========================================================

CREATE TABLE document_type_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_type VARCHAR(50) NOT NULL,
  keyword VARCHAR(100) NOT NULL,
  match_type ENUM('CONTAINS', 'REGEX', 'EXACT') DEFAULT 'CONTAINS',
  score INT DEFAULT 10,
  active_yn CHAR(1) DEFAULT 'Y',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_document_type_rules_type (document_type),
  KEY idx_document_type_rules_keyword (keyword)
);

INSERT INTO document_type_rules
(document_type, keyword, match_type, score, active_yn)
VALUES
('ITEM_RECEIPT', '판매합계', 'CONTAINS', 20, 'Y'),
('ITEM_RECEIPT', '과세 합계', 'CONTAINS', 20, 'Y'),
('ITEM_RECEIPT', '부가세', 'CONTAINS', 10, 'Y'),
('ITEM_RECEIPT', '\\[[0-9]{4,}\\]', 'REGEX', 20, 'Y'),
('TRANSPORT_RECEIPT', 'KTX', 'CONTAINS', 30, 'Y'),
('TRANSPORT_RECEIPT', '코레일', 'CONTAINS', 30, 'Y'),
('TRANSPORT_RECEIPT', '승차권', 'CONTAINS', 25, 'Y'),
('TRANSPORT_RECEIPT', '출발', 'CONTAINS', 10, 'Y'),
('TRANSPORT_RECEIPT', '도착', 'CONTAINS', 10, 'Y'),
('TRANSPORT_RECEIPT', '시외버스', 'CONTAINS', 30, 'Y'),
('TRANSPORT_RECEIPT', '고속버스', 'CONTAINS', 30, 'Y'),
('TRANSPORT_RECEIPT', '터미널', 'CONTAINS', 25, 'Y'),
('CARD_RECEIPT', '승인번호', 'CONTAINS', 25, 'Y'),
('CARD_RECEIPT', '승인금액', 'CONTAINS', 25, 'Y'),
('CARD_RECEIPT', '카드번호', 'CONTAINS', 20, 'Y'),
('CARD_RECEIPT', '가맹점', 'CONTAINS', 15, 'Y');


-- =========================================================
-- 20. document_section_rules
-- =========================================================

CREATE TABLE document_section_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_type VARCHAR(50) NOT NULL,

  section_type ENUM(
    'ITEM_START', 'ITEM_END', 'SUMMARY', 'PAYMENT', 'DISCOUNT', 'EXCLUDE'
  ) NOT NULL,

  keyword VARCHAR(100) NOT NULL,
  match_type ENUM('CONTAINS', 'REGEX', 'EXACT') DEFAULT 'CONTAINS',

  target_field_key VARCHAR(100),
  priority INT DEFAULT 100,
  active_yn CHAR(1) DEFAULT 'Y',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_section_rules_type (document_type),
  KEY idx_section_rules_section (section_type),
  KEY idx_section_rules_keyword (keyword),
  KEY idx_section_rules_field (target_field_key)
);

INSERT INTO document_section_rules
(document_type, section_type, keyword, match_type, target_field_key, priority, active_yn)
VALUES
('ITEM_RECEIPT', 'ITEM_END', '과세 합계', 'CONTAINS', 'taxable_amount', 10, 'Y'),
('ITEM_RECEIPT', 'ITEM_END', '과세합계', 'CONTAINS', 'taxable_amount', 10, 'Y'),
('ITEM_RECEIPT', 'ITEM_END', '부가세', 'CONTAINS', 'tax_amount', 20, 'Y'),
('ITEM_RECEIPT', 'ITEM_END', '공급가액', 'CONTAINS', 'supply_amount', 20, 'Y'),
('ITEM_RECEIPT', 'ITEM_END', '판매합계', 'CONTAINS', 'total_amount', 30, 'Y'),
('ITEM_RECEIPT', 'ITEM_END', '합계', 'CONTAINS', 'total_amount', 40, 'Y'),
('ITEM_RECEIPT', 'SUMMARY', '과세 합계', 'CONTAINS', 'taxable_amount', 10, 'Y'),
('ITEM_RECEIPT', 'SUMMARY', '과세합계', 'CONTAINS', 'taxable_amount', 10, 'Y'),
('ITEM_RECEIPT', 'SUMMARY', '공급가액', 'CONTAINS', 'supply_amount', 20, 'Y'),
('ITEM_RECEIPT', 'SUMMARY', '부가세', 'CONTAINS', 'tax_amount', 30, 'Y'),
('ITEM_RECEIPT', 'SUMMARY', '판매합계', 'CONTAINS', 'total_amount', 40, 'Y'),
('ITEM_RECEIPT', 'SUMMARY', '합계', 'CONTAINS', 'total_amount', 50, 'Y'),
('ITEM_RECEIPT', 'PAYMENT', '카드/간편결제', 'CONTAINS', 'payment_method', 10, 'Y'),
('ITEM_RECEIPT', 'PAYMENT', '카드', 'CONTAINS', 'payment_method', 20, 'Y'),
('ITEM_RECEIPT', 'PAYMENT', '현금', 'CONTAINS', 'payment_method', 30, 'Y'),
('ITEM_RECEIPT', 'PAYMENT', '승인번호', 'CONTAINS', 'approval_number', 40, 'Y'),
('ITEM_RECEIPT', 'PAYMENT', '승인금액', 'CONTAINS', 'paid_amount', 50, 'Y'),
('ITEM_RECEIPT', 'DISCOUNT', '포인트', 'CONTAINS', 'discount_amount', 10, 'Y'),
('ITEM_RECEIPT', 'DISCOUNT', '할인', 'CONTAINS', 'discount_amount', 20, 'Y'),
('ITEM_RECEIPT', 'EXCLUDE', '본사', 'CONTAINS', NULL, 10, 'Y'),
('ITEM_RECEIPT', 'EXCLUDE', '대표', 'CONTAINS', NULL, 20, 'Y'),
('ITEM_RECEIPT', 'EXCLUDE', '매장', 'CONTAINS', NULL, 30, 'Y'),
('ITEM_RECEIPT', 'EXCLUDE', '전화', 'CONTAINS', NULL, 40, 'Y'),
('ITEM_RECEIPT', 'EXCLUDE', '문의', 'CONTAINS', NULL, 50, 'Y'),
('ITEM_RECEIPT', 'EXCLUDE', '교환', 'CONTAINS', NULL, 60, 'Y'),
('ITEM_RECEIPT', 'EXCLUDE', '환불', 'CONTAINS', NULL, 70, 'Y'),
('ITEM_RECEIPT', 'EXCLUDE', '인증기업', 'CONTAINS', NULL, 80, 'Y');


-- =========================================================
-- 완료 확인 쿼리
-- =========================================================

SELECT 'roles' AS tbl, COUNT(*) AS cnt FROM roles
UNION ALL SELECT 'departments', COUNT(*) FROM departments
UNION ALL SELECT 'sites', COUNT(*) FROM sites
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'expense_categories', COUNT(*) FROM expense_categories
UNION ALL SELECT 'standard_fields', COUNT(*) FROM standard_fields
UNION ALL SELECT 'field_aliases', COUNT(*) FROM field_aliases
UNION ALL SELECT 'document_type_fields', COUNT(*) FROM document_type_fields
UNION ALL SELECT 'validation_rules', COUNT(*) FROM validation_rules
UNION ALL SELECT 'document_types', COUNT(*) FROM document_types
UNION ALL SELECT 'document_type_rules', COUNT(*) FROM document_type_rules
UNION ALL SELECT 'document_section_rules', COUNT(*) FROM document_section_rules;



-- =========================================================
-- correction_dictionaries 기본 보정사전 Seed
-- 생성일: 2026-06-15
-- 목적: OCR 오인식/표기 흔들림/결제수단/경비분류 표준화
-- 주의: 품목 가격이나 특정 영수증 결과를 강제하는 하드코딩 데이터가 아닙니다.
-- =========================================================

CREATE TABLE IF NOT EXISTS correction_dictionaries (
  id INT NOT NULL AUTO_INCREMENT,
  dictionary_type VARCHAR(50) NOT NULL,
  wrong_text VARCHAR(255) NOT NULL,
  corrected_text VARCHAR(255) NOT NULL,
  match_type VARCHAR(30) NOT NULL DEFAULT 'EXACT',
  min_similarity DECIMAL(5,4) NULL DEFAULT 0.8500,
  document_type VARCHAR(50) NULL DEFAULT 'COMMON',
  priority INT NOT NULL DEFAULT 100,

  -- 승인 정책:
  --   - MANAGER 등록: PENDING / active_yn='N'
  --   - SYSTEM_ADMIN 승인: APPROVED / active_yn='Y'
  --   - DISABLED/REJECTED: active_yn='N'
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  active_yn CHAR(1) NOT NULL DEFAULT 'N',

  description TEXT NULL,

  -- suggested_by는 사용자 ID가 아니라 제안 출처 문자열(USER/AI/SYSTEM)입니다.
  -- 실제 사용자 ID는 created_by / approved_by에 저장합니다.
  suggested_by VARCHAR(50) NULL DEFAULT 'USER',
  created_by INT NULL,
  approved_by INT NULL,
  approved_at DATETIME NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_correction_type (dictionary_type),
  INDEX idx_correction_active (active_yn),
  INDEX idx_correction_status (status),
  INDEX idx_correction_document_type (document_type),
  INDEX idx_correction_priority (priority),
  INDEX idx_correction_created_by (created_by),
  INDEX idx_correction_approved_by (approved_by),

  CONSTRAINT fk_correction_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_correction_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TEMPORARY TABLE IF EXISTS tmp_correction_dictionary_seed;

-- MEMORY 엔진은 TEXT/BLOB 컬럼을 지원하지 않으므로 InnoDB 임시 테이블 사용
CREATE TEMPORARY TABLE tmp_correction_dictionary_seed (
  dictionary_type VARCHAR(50) NOT NULL,
  wrong_text VARCHAR(255) NOT NULL,
  corrected_text VARCHAR(255) NOT NULL,
  match_type VARCHAR(30) NOT NULL,
  min_similarity DECIMAL(5,4) NULL,
  document_type VARCHAR(50) NULL,
  priority INT NOT NULL,
  status VARCHAR(30) NOT NULL,
  active_yn CHAR(1) NOT NULL,
  description TEXT NULL
) ENGINE=InnoDB;

INSERT INTO tmp_correction_dictionary_seed
(dictionary_type, wrong_text, corrected_text, match_type, min_similarity, document_type, priority, status, active_yn, description)
VALUES
('OCR_TEXT', '서을', '서울', 'EXACT', 1.0000, 'COMMON', 1, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '서울시', '서울시', 'EXACT', 1.0000, 'COMMON', 2, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '서울특별시', '서울특별시', 'EXACT', 1.0000, 'COMMON', 3, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '겸기도', '경기도', 'EXACT', 1.0000, 'COMMON', 4, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '경기도', '경기도', 'EXACT', 1.0000, 'COMMON', 5, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '의점부', '의정부', 'EXACT', 1.0000, 'COMMON', 6, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '의점부시', '의정부시', 'EXACT', 1.0000, 'COMMON', 7, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '의정부민락점', '의정부민락점', 'EXACT', 1.0000, 'COMMON', 8, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '강남구 남부순함로', '강남구 남부순환로', 'EXACT', 1.0000, 'COMMON', 9, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '남부순함로', '남부순환로', 'EXACT', 1.0000, 'COMMON', 10, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '남부순환로2748', '남부순환로 2748', 'EXACT', 1.0000, 'COMMON', 11, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '도곡등', '도곡동', 'EXACT', 1.0000, 'COMMON', 12, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '민락등', '민락동', 'EXACT', 1.0000, 'COMMON', 13, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '신정등', '신정동', 'EXACT', 1.0000, 'COMMON', 14, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '매잠', '매장', 'EXACT', 1.0000, 'COMMON', 15, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '메장', '매장', 'EXACT', 1.0000, 'COMMON', 16, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '가명점', '가맹점', 'EXACT', 1.0000, 'COMMON', 17, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '가맹전', '가맹점', 'EXACT', 1.0000, 'COMMON', 18, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '가맹점명', '가맹점명', 'EXACT', 1.0000, 'COMMON', 19, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '상호멍', '상호명', 'EXACT', 1.0000, 'COMMON', 20, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '업채명', '업체명', 'EXACT', 1.0000, 'COMMON', 21, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '영수즘', '영수증', 'EXACT', 1.0000, 'COMMON', 22, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '영수중', '영수증', 'EXACT', 1.0000, 'COMMON', 23, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '영수층', '영수증', 'EXACT', 1.0000, 'COMMON', 24, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '전자영수즘', '전자영수증', 'EXACT', 1.0000, 'COMMON', 25, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '재발햄', '재발행', 'EXACT', 1.0000, 'COMMON', 26, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '재발헹', '재발행', 'EXACT', 1.0000, 'COMMON', 27, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '재발행전표', '재발행 전표', 'EXACT', 1.0000, 'COMMON', 28, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '매출천표', '매출전표', 'EXACT', 1.0000, 'COMMON', 29, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '매출전포', '매출전표', 'EXACT', 1.0000, 'COMMON', 30, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '전포', '전표', 'EXACT', 1.0000, 'COMMON', 31, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '전표', '전표', 'EXACT', 1.0000, 'COMMON', 32, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '췌손', '훼손', 'EXACT', 1.0000, 'COMMON', 33, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '웨손', '훼손', 'EXACT', 1.0000, 'COMMON', 34, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '훼손시', '훼손 시', 'EXACT', 1.0000, 'COMMON', 35, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '지침', '지참', 'EXACT', 1.0000, 'COMMON', 36, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '지참후', '지참 후', 'EXACT', 1.0000, 'COMMON', 37, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '구입매장에서', '구입 매장에서', 'EXACT', 1.0000, 'COMMON', 38, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '구입메장에서', '구입 매장에서', 'EXACT', 1.0000, 'COMMON', 39, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '소비자증심', '소비자중심', 'EXACT', 1.0000, 'COMMON', 40, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '소비지중심', '소비자중심', 'EXACT', 1.0000, 'COMMON', 41, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '소비자중심겸영', '소비자중심경영', 'EXACT', 1.0000, 'COMMON', 42, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '품질겸영', '품질경영', 'EXACT', 1.0000, 'COMMON', 43, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '품질경영시스템인증기업', '품질경영시스템 인증기업', 'EXACT', 1.0000, 'COMMON', 44, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', 'IS09001', 'ISO9001', 'EXACT', 1.0000, 'COMMON', 45, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '1S09001', 'ISO9001', 'EXACT', 1.0000, 'COMMON', 46, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', 'ISO900I', 'ISO9001', 'EXACT', 1.0000, 'COMMON', 47, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', 'IS09OO1', 'ISO9001', 'EXACT', 1.0000, 'COMMON', 48, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '부"가세', '부가세', 'EXACT', 1.0000, 'COMMON', 49, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '부가새', '부가세', 'EXACT', 1.0000, 'COMMON', 50, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '부가셰', '부가세', 'EXACT', 1.0000, 'COMMON', 51, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '부가세과세', '부가세 과세', 'EXACT', 1.0000, 'COMMON', 52, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '부가세과세!합계', '부가세 과세 합계', 'EXACT', 1.0000, 'COMMON', 53, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '과세합계', '과세 합계', 'EXACT', 1.0000, 'COMMON', 54, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '판매합계', '판매 합계', 'EXACT', 1.0000, 'COMMON', 55, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '판매 합계', '판매 합계', 'EXACT', 1.0000, 'COMMON', 56, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '합 계', '합계', 'EXACT', 1.0000, 'COMMON', 57, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '총 계', '총계', 'EXACT', 1.0000, 'COMMON', 58, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '총액', '총액', 'EXACT', 1.0000, 'COMMON', 59, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '청구금액', '청구금액', 'EXACT', 1.0000, 'COMMON', 60, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '결제금액', '결제금액', 'EXACT', 1.0000, 'COMMON', 61, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '결제 금액', '결제금액', 'EXACT', 1.0000, 'COMMON', 62, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '승인금액', '승인금액', 'EXACT', 1.0000, 'COMMON', 63, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '승인 금액', '승인금액', 'EXACT', 1.0000, 'COMMON', 64, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '승인번호', '승인번호', 'EXACT', 1.0000, 'COMMON', 65, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '승인 번호', '승인번호', 'EXACT', 1.0000, 'COMMON', 66, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '카드간편결제', '카드/간편결제', 'EXACT', 1.0000, 'COMMON', 67, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '카드/간편 결제', '카드/간편결제', 'EXACT', 1.0000, 'COMMON', 68, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '간편 결제', '간편결제', 'EXACT', 1.0000, 'COMMON', 69, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '네이버페이(카드)', '네이버페이(카드)', 'EXACT', 1.0000, 'COMMON', 70, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '포인트카드/간편결제', '포인트 카드/간편결제', 'EXACT', 1.0000, 'COMMON', 71, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '사용포인트', '사용 포인트', 'EXACT', 1.0000, 'COMMON', 72, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '적립포인트', '적립 포인트', 'EXACT', 1.0000, 'COMMON', 73, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '가용포인트', '가용 포인트', 'EXACT', 1.0000, 'COMMON', 74, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '적립대상결제금액', '적립대상 결제금액', 'EXACT', 1.0000, 'COMMON', 75, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '삼품', '상품', 'EXACT', 1.0000, 'COMMON', 76, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '상품및', '상품 및', 'EXACT', 1.0000, 'COMMON', 77, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '문의:', '문의:', 'EXACT', 1.0000, 'COMMON', 78, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '문의 :', '문의:', 'EXACT', 1.0000, 'COMMON', 79, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '기타문의', '기타 문의', 'EXACT', 1.0000, 'COMMON', 80, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '멤버십및', '멤버십 및', 'EXACT', 1.0000, 'COMMON', 81, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '현금영수즘', '현금영수증', 'EXACT', 1.0000, 'COMMON', 82, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '현금영수중', '현금영수증', 'EXACT', 1.0000, 'COMMON', 83, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '신용카드매출전표', '신용카드 매출전표', 'EXACT', 1.0000, 'COMMON', 84, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '체크카드취소', '체크카드 취소', 'EXACT', 1.0000, 'COMMON', 85, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '취소시', '취소 시', 'EXACT', 1.0000, 'COMMON', 86, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '대표자', '대표자', 'EXACT', 1.0000, 'COMMON', 87, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '대표:', '대표:', 'EXACT', 1.0000, 'COMMON', 88, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '전화:', '전화:', 'EXACT', 1.0000, 'COMMON', 89, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '주소:', '주소:', 'EXACT', 1.0000, 'COMMON', 90, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '사업자등록번호', '사업자등록번호', 'EXACT', 1.0000, 'COMMON', 91, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '사업자번호', '사업자번호', 'EXACT', 1.0000, 'COMMON', 92, 'APPROVED', 'Y', '공통 OCR 오인식/띄어쓰기 보정'),
('OCR_TEXT', '결제카드 지참 후구입매장에서', '결제카드 지참 후 구입 매장에서', 'CONTAINS', 0.9000, 'COMMON', 200, 'APPROVED', 'Y', '공통 OCR 연결 문자열 보정'),
('OCR_TEXT', '체크카드취소시최대', '체크카드 취소 시 최대', 'CONTAINS', 0.9000, 'COMMON', 201, 'APPROVED', 'Y', '공통 OCR 연결 문자열 보정'),
('OCR_TEXT', '상품및 기타문의', '상품 및 기타 문의', 'CONTAINS', 0.9000, 'COMMON', 202, 'APPROVED', 'Y', '공통 OCR 연결 문자열 보정'),
('OCR_TEXT', '적립대상 결제금액:', '적립대상 결제금액:', 'CONTAINS', 0.9000, 'COMMON', 203, 'APPROVED', 'Y', '공통 OCR 연결 문자열 보정'),
('OCR_TEXT', '승인번호747', '승인번호 747', 'CONTAINS', 0.9000, 'COMMON', 204, 'APPROVED', 'Y', '공통 OCR 연결 문자열 보정'),
('OCR_TEXT', '승인금액2,', '승인금액 2,', 'CONTAINS', 0.9000, 'COMMON', 205, 'APPROVED', 'Y', '공통 OCR 연결 문자열 보정'),
('OCR_TEXT', '승인금액10,', '승인금액 10,', 'CONTAINS', 0.9000, 'COMMON', 206, 'APPROVED', 'Y', '공통 OCR 연결 문자열 보정'),
('VENDOR', '파리바게트', '파리바게뜨', 'EXACT', 1.0000, 'RECEIPT', 1, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '파리바게뜨', '파리바게뜨', 'EXACT', 1.0000, 'RECEIPT', 2, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '파리바게드', '파리바게뜨', 'EXACT', 1.0000, 'RECEIPT', 3, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '파리바게뜨점', '파리바게뜨', 'EXACT', 1.0000, 'RECEIPT', 4, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'PARISBAGUETTE', '파리바게뜨', 'CONTAINS', 0.9000, 'RECEIPT', 5, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'PARIS BAGUETTE', '파리바게뜨', 'CONTAINS', 0.9000, 'RECEIPT', 6, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'Paris Baguette', '파리바게뜨', 'CONTAINS', 0.9000, 'RECEIPT', 7, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '매머드익스프레스', '매머드 익스프레스', 'EXACT', 1.0000, 'RECEIPT', 8, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '메머드익스프레스', '매머드 익스프레스', 'EXACT', 1.0000, 'RECEIPT', 9, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '맥머드익스프레스', '매머드 익스프레스', 'EXACT', 1.0000, 'RECEIPT', 10, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '맥먹드익스프레스', '매머드 익스프레스', 'EXACT', 1.0000, 'RECEIPT', 11, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'MAMMOTH EXPRESS', '매머드 익스프레스', 'CONTAINS', 0.9000, 'RECEIPT', 12, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '스타벅스커피', '스타벅스', 'EXACT', 1.0000, 'RECEIPT', 13, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '스타벅스 코리아', '스타벅스', 'EXACT', 1.0000, 'RECEIPT', 14, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'STARBUCKS', '스타벅스', 'EXACT', 1.0000, 'RECEIPT', 15, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'Starbucks', '스타벅스', 'EXACT', 1.0000, 'RECEIPT', 16, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '이디야커피', '이디야커피', 'EXACT', 1.0000, 'RECEIPT', 17, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'EDIYA', '이디야커피', 'EXACT', 1.0000, 'RECEIPT', 18, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '컴포즈커피', '컴포즈커피', 'EXACT', 1.0000, 'RECEIPT', 19, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'COMPOSE COFFEE', '컴포즈커피', 'CONTAINS', 0.9000, 'RECEIPT', 20, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '메가커피', '메가MGC커피', 'EXACT', 1.0000, 'RECEIPT', 21, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'MEGA COFFEE', '메가MGC커피', 'EXACT', 1.0000, 'RECEIPT', 22, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '메가MGC커피', '메가MGC커피', 'EXACT', 1.0000, 'RECEIPT', 23, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '투썸플레이스', '투썸플레이스', 'EXACT', 1.0000, 'RECEIPT', 24, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'A TWOSOME PLACE', '투썸플레이스', 'CONTAINS', 0.9000, 'RECEIPT', 25, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '빽다방', '빽다방', 'EXACT', 1.0000, 'RECEIPT', 26, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'PAIKS COFFEE', '빽다방', 'CONTAINS', 0.9000, 'RECEIPT', 27, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '아성다이소', '다이소', 'EXACT', 1.0000, 'RECEIPT', 28, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '(주)아성다이소', '다이소', 'EXACT', 1.0000, 'RECEIPT', 29, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '국민가게,다이소', '다이소', 'EXACT', 1.0000, 'RECEIPT', 30, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '국민가게 다이소', '다이소', 'EXACT', 1.0000, 'RECEIPT', 31, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '다이소', '다이소', 'EXACT', 1.0000, 'RECEIPT', 32, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'DAISO', '다이소', 'EXACT', 1.0000, 'RECEIPT', 33, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'Daiso', '다이소', 'EXACT', 1.0000, 'RECEIPT', 34, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'H이소', '다이소', 'EXACT', 1.0000, 'RECEIPT', 35, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '씨유', 'CU', 'EXACT', 1.0000, 'RECEIPT', 36, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'CU편의점', 'CU', 'EXACT', 1.0000, 'RECEIPT', 37, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'CU', 'CU', 'EXACT', 1.0000, 'RECEIPT', 38, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '씨유편의점', 'CU', 'EXACT', 1.0000, 'RECEIPT', 39, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'GS25', 'GS25', 'EXACT', 1.0000, 'RECEIPT', 40, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '지에스25', 'GS25', 'EXACT', 1.0000, 'RECEIPT', 41, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'GS 25', 'GS25', 'EXACT', 1.0000, 'RECEIPT', 42, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '세븐일레븐', '세븐일레븐', 'EXACT', 1.0000, 'RECEIPT', 43, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '7-ELEVEN', '세븐일레븐', 'EXACT', 1.0000, 'RECEIPT', 44, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '이마트24', '이마트24', 'EXACT', 1.0000, 'RECEIPT', 45, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'emart24', '이마트24', 'EXACT', 1.0000, 'RECEIPT', 46, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '롯데리아', '롯데리아', 'EXACT', 1.0000, 'RECEIPT', 47, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'LOTTERIA', '롯데리아', 'EXACT', 1.0000, 'RECEIPT', 48, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '맥도날드', '맥도날드', 'EXACT', 1.0000, 'RECEIPT', 49, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'McDonald', '맥도날드', 'EXACT', 1.0000, 'RECEIPT', 50, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'MCDONALD', '맥도날드', 'EXACT', 1.0000, 'RECEIPT', 51, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '버거킹', '버거킹', 'EXACT', 1.0000, 'RECEIPT', 52, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'BURGER KING', '버거킹', 'EXACT', 1.0000, 'RECEIPT', 53, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '맘스터치', '맘스터치', 'EXACT', 1.0000, 'RECEIPT', 54, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'MOMSTOUCH', '맘스터치', 'EXACT', 1.0000, 'RECEIPT', 55, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '배스킨라빈스', '배스킨라빈스', 'EXACT', 1.0000, 'RECEIPT', 56, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '베스킨라빈스', '배스킨라빈스', 'EXACT', 1.0000, 'RECEIPT', 57, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'BASKIN ROBBINS', '배스킨라빈스', 'CONTAINS', 0.9000, 'RECEIPT', 58, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '던킨', '던킨', 'EXACT', 1.0000, 'RECEIPT', 59, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'DUNKIN', '던킨', 'EXACT', 1.0000, 'RECEIPT', 60, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '코레일', '코레일', 'EXACT', 1.0000, 'RECEIPT', 61, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'KORAIL', '코레일', 'EXACT', 1.0000, 'RECEIPT', 62, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '한국철도공사', '코레일', 'EXACT', 1.0000, 'RECEIPT', 63, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'SRT', 'SRT', 'EXACT', 1.0000, 'RECEIPT', 64, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '수서고속철도', 'SRT', 'EXACT', 1.0000, 'RECEIPT', 65, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '티머니', '티머니', 'EXACT', 1.0000, 'RECEIPT', 66, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'Tmoney', '티머니', 'EXACT', 1.0000, 'RECEIPT', 67, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '고속버스', '고속버스', 'EXACT', 1.0000, 'RECEIPT', 68, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '시외버스', '시외버스', 'EXACT', 1.0000, 'RECEIPT', 69, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '카카오택시', '카카오 T', 'EXACT', 1.0000, 'RECEIPT', 70, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '카카오T', '카카오 T', 'EXACT', 1.0000, 'RECEIPT', 71, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'KAKAO T', '카카오 T', 'EXACT', 1.0000, 'RECEIPT', 72, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '우버택시', '우버', 'EXACT', 1.0000, 'RECEIPT', 73, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'UT택시', '우티', 'EXACT', 1.0000, 'RECEIPT', 74, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '이마트', '이마트', 'EXACT', 1.0000, 'RECEIPT', 75, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'EMART', '이마트', 'EXACT', 1.0000, 'RECEIPT', 76, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '롯데마트', '롯데마트', 'EXACT', 1.0000, 'RECEIPT', 77, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '홈플러스', '홈플러스', 'EXACT', 1.0000, 'RECEIPT', 78, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '농협하나로마트', '하나로마트', 'EXACT', 1.0000, 'RECEIPT', 79, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '하나로마트', '하나로마트', 'EXACT', 1.0000, 'RECEIPT', 80, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '쿠팡', '쿠팡', 'EXACT', 1.0000, 'RECEIPT', 81, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'COUPANG', '쿠팡', 'EXACT', 1.0000, 'RECEIPT', 82, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '네이버페이', '네이버페이', 'EXACT', 1.0000, 'RECEIPT', 83, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'NAVER PAY', '네이버페이', 'EXACT', 1.0000, 'RECEIPT', 84, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', '카카오페이', '카카오페이', 'EXACT', 1.0000, 'RECEIPT', 85, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('VENDOR', 'KAKAOPAY', '카카오페이', 'EXACT', 1.0000, 'RECEIPT', 86, 'APPROVED', 'Y', '상호명 표기 흔들림 표준화'),
('PAYMENT', '카드', '카드', 'EXACT', 0.9000, 'RECEIPT', 1, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '신용카드', '신용카드', 'CONTAINS', 0.9000, 'RECEIPT', 2, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '체크카드', '체크카드', 'CONTAINS', 0.9000, 'RECEIPT', 3, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '법인카드', '법인카드', 'CONTAINS', 0.9000, 'RECEIPT', 4, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '개인카드', '개인카드', 'CONTAINS', 0.9000, 'RECEIPT', 5, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '카드결제', '카드', 'CONTAINS', 0.9000, 'RECEIPT', 6, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '카드 결제', '카드', 'CONTAINS', 0.9000, 'RECEIPT', 7, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '간편결제', '간편결제', 'CONTAINS', 0.9000, 'RECEIPT', 8, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '간편 결제', '간편결제', 'CONTAINS', 0.9000, 'RECEIPT', 9, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '카드/간편결제', '카드/간편결제', 'CONTAINS', 0.9000, 'RECEIPT', 10, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '포인트카드/간편결제', '카드/간편결제', 'CONTAINS', 0.9000, 'RECEIPT', 11, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '네이버페이', '네이버페이', 'CONTAINS', 0.9000, 'RECEIPT', 12, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '네이버 페이', '네이버페이', 'CONTAINS', 0.9000, 'RECEIPT', 13, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', 'NAVER PAY', '네이버페이', 'CONTAINS', 0.9000, 'RECEIPT', 14, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', 'N페이', '네이버페이', 'CONTAINS', 0.9000, 'RECEIPT', 15, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '카카오페이', '카카오페이', 'CONTAINS', 0.9000, 'RECEIPT', 16, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '카카오 페이', '카카오페이', 'CONTAINS', 0.9000, 'RECEIPT', 17, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', 'KAKAO PAY', '카카오페이', 'CONTAINS', 0.9000, 'RECEIPT', 18, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '삼성페이', '삼성페이', 'CONTAINS', 0.9000, 'RECEIPT', 19, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', 'SAMSUNG PAY', '삼성페이', 'CONTAINS', 0.9000, 'RECEIPT', 20, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '페이코', '페이코', 'CONTAINS', 0.9000, 'RECEIPT', 21, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', 'PAYCO', '페이코', 'CONTAINS', 0.9000, 'RECEIPT', 22, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '토스페이', '토스페이', 'CONTAINS', 0.9000, 'RECEIPT', 23, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', 'TOSS PAY', '토스페이', 'CONTAINS', 0.9000, 'RECEIPT', 24, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '현금', '현금', 'EXACT', 0.9000, 'RECEIPT', 25, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '현금결제', '현금', 'CONTAINS', 0.9000, 'RECEIPT', 26, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '계좌이체', '계좌이체', 'CONTAINS', 0.9000, 'RECEIPT', 27, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '계좌 이체', '계좌이체', 'CONTAINS', 0.9000, 'RECEIPT', 28, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '무통장입금', '계좌이체', 'CONTAINS', 0.9000, 'RECEIPT', 29, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '포인트', '포인트', 'CONTAINS', 0.9000, 'RECEIPT', 30, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '쿠폰', '쿠폰', 'EXACT', 0.9000, 'RECEIPT', 31, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '국민카드', 'KB국민카드', 'CONTAINS', 0.9000, 'RECEIPT', 32, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', 'KB국민카드', 'KB국민카드', 'CONTAINS', 0.9000, 'RECEIPT', 33, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '비씨카드', 'BC카드', 'CONTAINS', 0.9000, 'RECEIPT', 34, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', 'BC카드', 'BC카드', 'CONTAINS', 0.9000, 'RECEIPT', 35, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '신한카드', '신한카드', 'CONTAINS', 0.9000, 'RECEIPT', 36, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '삼성카드', '삼성카드', 'CONTAINS', 0.9000, 'RECEIPT', 37, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '현대카드', '현대카드', 'CONTAINS', 0.9000, 'RECEIPT', 38, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '롯데카드', '롯데카드', 'CONTAINS', 0.9000, 'RECEIPT', 39, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '하나카드', '하나카드', 'CONTAINS', 0.9000, 'RECEIPT', 40, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '우리카드', '우리카드', 'CONTAINS', 0.9000, 'RECEIPT', 41, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', '농협카드', 'NH농협카드', 'CONTAINS', 0.9000, 'RECEIPT', 42, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('PAYMENT', 'NH농협카드', 'NH농협카드', 'CONTAINS', 0.9000, 'RECEIPT', 43, 'APPROVED', 'Y', '결제수단/카드사 표준화'),
('CATEGORY', '식비', '식비', 'EXACT', 1.0000, 'RECEIPT', 1, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '식대', '식비', 'EXACT', 1.0000, 'RECEIPT', 2, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '식사', '식비', 'EXACT', 1.0000, 'RECEIPT', 3, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '음식', '식비', 'EXACT', 1.0000, 'RECEIPT', 4, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '음식점', '식비', 'EXACT', 1.0000, 'RECEIPT', 5, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '카페', '식비', 'EXACT', 1.0000, 'RECEIPT', 6, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '커피', '식비', 'EXACT', 1.0000, 'RECEIPT', 7, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '간식', '식비', 'EXACT', 1.0000, 'RECEIPT', 8, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '도시락', '식비', 'EXACT', 1.0000, 'RECEIPT', 9, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '회식', '식비', 'EXACT', 1.0000, 'RECEIPT', 10, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '교통비', '교통비', 'EXACT', 1.0000, 'RECEIPT', 11, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '교통', '교통비', 'EXACT', 1.0000, 'RECEIPT', 12, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '여비교통비', '교통비', 'EXACT', 1.0000, 'RECEIPT', 13, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '택시', '교통비', 'EXACT', 1.0000, 'RECEIPT', 14, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '버스', '교통비', 'EXACT', 1.0000, 'RECEIPT', 15, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '고속버스', '교통비', 'EXACT', 1.0000, 'RECEIPT', 16, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '시외버스', '교통비', 'EXACT', 1.0000, 'RECEIPT', 17, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '기차', '교통비', 'EXACT', 1.0000, 'RECEIPT', 18, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', 'KTX', '교통비', 'EXACT', 1.0000, 'RECEIPT', 19, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', 'SRT', '교통비', 'EXACT', 1.0000, 'RECEIPT', 20, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '지하철', '교통비', 'EXACT', 1.0000, 'RECEIPT', 21, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '주차', '교통비', 'EXACT', 1.0000, 'RECEIPT', 22, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '주차비', '교통비', 'EXACT', 1.0000, 'RECEIPT', 23, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '통행료', '교통비', 'EXACT', 1.0000, 'RECEIPT', 24, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '하이패스', '교통비', 'EXACT', 1.0000, 'RECEIPT', 25, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '숙박비', '숙박비', 'EXACT', 1.0000, 'RECEIPT', 26, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '숙박', '숙박비', 'EXACT', 1.0000, 'RECEIPT', 27, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '호텔', '숙박비', 'EXACT', 1.0000, 'RECEIPT', 28, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '모텔', '숙박비', 'EXACT', 1.0000, 'RECEIPT', 29, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '게스트하우스', '숙박비', 'EXACT', 1.0000, 'RECEIPT', 30, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '펜션', '숙박비', 'EXACT', 1.0000, 'RECEIPT', 31, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '숙소', '숙박비', 'EXACT', 1.0000, 'RECEIPT', 32, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '소모품비', '소모품비', 'EXACT', 1.0000, 'RECEIPT', 33, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '소모품', '소모품비', 'EXACT', 1.0000, 'RECEIPT', 34, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '사무용품', '소모품비', 'EXACT', 1.0000, 'RECEIPT', 35, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '문구', '소모품비', 'EXACT', 1.0000, 'RECEIPT', 36, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '비품', '소모품비', 'EXACT', 1.0000, 'RECEIPT', 37, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '잡화', '소모품비', 'EXACT', 1.0000, 'RECEIPT', 38, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '현장소모품', '소모품비', 'EXACT', 1.0000, 'RECEIPT', 39, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '유류비', '유류비', 'EXACT', 1.0000, 'RECEIPT', 40, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '유류', '유류비', 'EXACT', 1.0000, 'RECEIPT', 41, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '주유', '유류비', 'EXACT', 1.0000, 'RECEIPT', 42, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '휘발유', '유류비', 'EXACT', 1.0000, 'RECEIPT', 43, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '경유', '유류비', 'EXACT', 1.0000, 'RECEIPT', 44, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', 'LPG', '유류비', 'EXACT', 1.0000, 'RECEIPT', 45, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '충전', '유류비', 'EXACT', 1.0000, 'RECEIPT', 46, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '전기차충전', '유류비', 'EXACT', 1.0000, 'RECEIPT', 47, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '통신비', '통신비', 'EXACT', 1.0000, 'RECEIPT', 48, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '통신', '통신비', 'EXACT', 1.0000, 'RECEIPT', 49, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '전화요금', '통신비', 'EXACT', 1.0000, 'RECEIPT', 50, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '인터넷', '통신비', 'EXACT', 1.0000, 'RECEIPT', 51, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '휴대폰', '통신비', 'EXACT', 1.0000, 'RECEIPT', 52, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '모바일', '통신비', 'EXACT', 1.0000, 'RECEIPT', 53, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '자재비', '자재비', 'EXACT', 1.0000, 'RECEIPT', 54, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '자재', '자재비', 'EXACT', 1.0000, 'RECEIPT', 55, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '재료비', '자재비', 'EXACT', 1.0000, 'RECEIPT', 56, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '공구', '자재비', 'EXACT', 1.0000, 'RECEIPT', 57, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '공사자재', '자재비', 'EXACT', 1.0000, 'RECEIPT', 58, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '건설자재', '자재비', 'EXACT', 1.0000, 'RECEIPT', 59, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '기타', '기타', 'EXACT', 1.0000, 'RECEIPT', 60, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '기타비용', '기타', 'EXACT', 1.0000, 'RECEIPT', 61, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '잡비', '기타', 'EXACT', 1.0000, 'RECEIPT', 62, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('CATEGORY', '미분류', '기타', 'EXACT', 1.0000, 'RECEIPT', 63, 'APPROVED', 'Y', '경비분류 표현 표준화'),
('OCR_TEXT', '출박', '출발', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 501, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '출발지', '출발지', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 502, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '도착지', '도착지', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 503, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '도착', '도착', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 504, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '승차', '승차', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 505, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '하차', '하차', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 506, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '좌석', '좌석', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 507, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '호차', '호차', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 508, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '열차번호', '열차번호', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 509, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '승차권', '승차권', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 510, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '탑승', '탑승', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 511, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '동서을', '동서울', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 512, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '동서욹', '동서울', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 513, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '횡게', '횡계', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 514, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '횡계', '횡계', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 515, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '강릉', '강릉', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 516, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '서울역', '서울역', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 517, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '수서', '수서', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 518, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '광명', '광명', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 519, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '부산', '부산', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 520, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '대전', '대전', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 521, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '동대구', '동대구', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 522, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '순천', '순천', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 523, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '광양', '광양', 'EXACT', 1.0000, 'TRANSPORT_RECEIPT', 524, 'APPROVED', 'Y', '교통 영수증 OCR 보정'),
('OCR_TEXT', '오전', '오전', 'EXACT', 1.0000, 'COMMON', 801, 'APPROVED', 'Y', '날짜/시간 라벨 보정'),
('OCR_TEXT', '오후', '오후', 'EXACT', 1.0000, 'COMMON', 802, 'APPROVED', 'Y', '날짜/시간 라벨 보정'),
('OCR_TEXT', '년월일', '년월일', 'EXACT', 1.0000, 'COMMON', 803, 'APPROVED', 'Y', '날짜/시간 라벨 보정'),
('OCR_TEXT', '일시', '일시', 'EXACT', 1.0000, 'COMMON', 804, 'APPROVED', 'Y', '날짜/시간 라벨 보정'),
('OCR_TEXT', '승인일시', '승인일시', 'EXACT', 1.0000, 'COMMON', 805, 'APPROVED', 'Y', '날짜/시간 라벨 보정'),
('OCR_TEXT', '거래일시', '거래일시', 'EXACT', 1.0000, 'COMMON', 806, 'APPROVED', 'Y', '날짜/시간 라벨 보정'),
('OCR_TEXT', '결제일시', '결제일시', 'EXACT', 1.0000, 'COMMON', 807, 'APPROVED', 'Y', '날짜/시간 라벨 보정'),
('OCR_TEXT', '사용일자', '사용일자', 'EXACT', 1.0000, 'COMMON', 808, 'APPROVED', 'Y', '날짜/시간 라벨 보정'),
('OCR_TEXT', '매출일자', '매출일자', 'EXACT', 1.0000, 'COMMON', 809, 'APPROVED', 'Y', '날짜/시간 라벨 보정');

INSERT INTO correction_dictionaries
(dictionary_type, wrong_text, corrected_text, match_type, min_similarity, document_type, priority, status, active_yn, description, suggested_by, created_by, approved_by, approved_at, created_at, updated_at)
SELECT
  s.dictionary_type,
  s.wrong_text,
  s.corrected_text,
  s.match_type,
  s.min_similarity,
  s.document_type,
  s.priority,
  s.status,
  s.active_yn,
  s.description,
  'SYSTEM',
  (SELECT id FROM users WHERE role_code = 'SYSTEM_ADMIN' ORDER BY id LIMIT 1),
  (SELECT id FROM users WHERE role_code = 'SYSTEM_ADMIN' ORDER BY id LIMIT 1),
  NOW(),
  NOW(),
  NOW()
FROM tmp_correction_dictionary_seed s
WHERE NOT EXISTS (
  SELECT 1
  FROM correction_dictionaries c
  WHERE c.dictionary_type = s.dictionary_type
    AND c.wrong_text = s.wrong_text
    AND COALESCE(c.document_type, 'COMMON') = COALESCE(s.document_type, 'COMMON')
);

-- 승인 정책 정리: 승인된 사전만 실제 적용(active_yn='Y')되도록 보정
UPDATE correction_dictionaries
SET active_yn = 'Y'
WHERE status = 'APPROVED';

UPDATE correction_dictionaries
SET active_yn = 'N', approved_by = NULL, approved_at = NULL
WHERE status IN ('PENDING', 'REJECTED');

UPDATE correction_dictionaries
SET active_yn = 'N'
WHERE status = 'DISABLED';

DROP TEMPORARY TABLE IF EXISTS tmp_correction_dictionary_seed;

-- 최종 확인
SELECT dictionary_type, COUNT(*) AS count
FROM correction_dictionaries
GROUP BY dictionary_type
ORDER BY dictionary_type;

-- =========================================================
-- 최종 스키마 확인
-- =========================================================
SELECT 'DB initialized' AS message, DATABASE() AS database_name;

SELECT
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'generated_documents'
  AND COLUMN_NAME IN ('source_file_id', 'status')
ORDER BY ORDINAL_POSITION;

SELECT
  CONSTRAINT_NAME,
  TABLE_NAME,
  COLUMN_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'generated_documents'
  AND COLUMN_NAME = 'source_file_id';

SELECT role_code, role_name FROM roles ORDER BY id;
SELECT department_code, department_name FROM departments ORDER BY id;
SELECT dictionary_type, COUNT(*) AS count FROM correction_dictionaries GROUP BY dictionary_type ORDER BY dictionary_type;


-- =========================================================
-- APPENDED PATCH 1: DB Rule Context 최소형 Seed
-- =========================================================

-- =========================================================
-- DB Rule Context 최소형 Seed / Patch
-- 생성일: 2026-06-16
-- 목적:
--   1) 기존 correction_dictionaries / document_type_rules / document_section_rules / validation_rules를
--      Python Rule Engine에 전달하는 DB Rule Context 기준 데이터 보강
--   2) 추가 화면 없이 기존 보정사전 관리화면과 DB seed만으로 규칙 운용
--   3) 중복 실행해도 안전하게 처리
-- =========================================================

-- ---------------------------------------------------------
-- 0. 카테고리 기준 확인/보강
-- ---------------------------------------------------------
INSERT INTO expense_categories (category_code, category_name, description, is_active)
SELECT 'MEAL', '식비', '식사, 회식, 카페, 베이커리 등 식음료 관련 비용', TRUE
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE category_code = 'MEAL');

INSERT INTO expense_categories (category_code, category_name, description, is_active)
SELECT 'TRANSPORT', '교통비', 'KTX, 버스, 택시, 주차, 통행료 등 이동 관련 비용', TRUE
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE category_code = 'TRANSPORT');

INSERT INTO expense_categories (category_code, category_name, description, is_active)
SELECT 'SUPPLIES', '소모품비', '현장/사무 소모품 구매 비용', TRUE
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE category_code = 'SUPPLIES');

INSERT INTO expense_categories (category_code, category_name, description, is_active)
SELECT 'ETC', '기타', '분류가 어려운 기타 비용', TRUE
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE category_code = 'ETC');

-- ---------------------------------------------------------
-- 1. correction_dictionaries: CATEGORY 키워드
--    corrected_text에는 카테고리 코드(MEAL/TRANSPORT/...)를 저장한다.
-- ---------------------------------------------------------
INSERT INTO correction_dictionaries
(dictionary_type, wrong_text, corrected_text, match_type, min_similarity, document_type, priority, status, active_yn, suggested_by, description, created_by, approved_by, approved_at)
SELECT v.dictionary_type, v.wrong_text, v.corrected_text, v.match_type, v.min_similarity, v.document_type, v.priority, 'APPROVED', 'Y', 'SYSTEM', v.description, NULL, NULL, CURRENT_TIMESTAMP
FROM (
  SELECT 'CATEGORY' dictionary_type, '갈비' wrong_text, 'MEAL' corrected_text, 'CONTAINS' match_type, NULL min_similarity, 'RECEIPT' document_type, 10 priority, '음식점/식비 키워드' description UNION ALL
  SELECT 'CATEGORY','양갈비','MEAL','CONTAINS',NULL,'RECEIPT',10,'음식점/식비 키워드' UNION ALL
  SELECT 'CATEGORY','프렌치랙','MEAL','CONTAINS',NULL,'RECEIPT',10,'음식점/식비 키워드' UNION ALL
  SELECT 'CATEGORY','마늘밥','MEAL','CONTAINS',NULL,'RECEIPT',10,'음식점/식비 키워드' UNION ALL
  SELECT 'CATEGORY','피자','MEAL','CONTAINS',NULL,'RECEIPT',10,'음식점/식비 키워드' UNION ALL
  SELECT 'CATEGORY','감바스','MEAL','CONTAINS',NULL,'RECEIPT',10,'음식점/식비 키워드' UNION ALL
  SELECT 'CATEGORY','우동','MEAL','CONTAINS',NULL,'RECEIPT',15,'음식점/식비 키워드' UNION ALL
  SELECT 'CATEGORY','김치','MEAL','CONTAINS',NULL,'RECEIPT',15,'음식점/식비 키워드' UNION ALL
  SELECT 'CATEGORY','두부','MEAL','CONTAINS',NULL,'RECEIPT',15,'음식점/식비 키워드' UNION ALL
  SELECT 'CATEGORY','전집','MEAL','CONTAINS',NULL,'RECEIPT',15,'음식점/식비 키워드' UNION ALL
  SELECT 'CATEGORY','카페','MEAL','CONTAINS',NULL,'RECEIPT',20,'카페/식비 키워드' UNION ALL
  SELECT 'CATEGORY','커피','MEAL','CONTAINS',NULL,'RECEIPT',20,'카페/식비 키워드' UNION ALL
  SELECT 'CATEGORY','라떼','MEAL','CONTAINS',NULL,'RECEIPT',20,'카페/식비 키워드' UNION ALL
  SELECT 'CATEGORY','아메리카노','MEAL','CONTAINS',NULL,'RECEIPT',20,'카페/식비 키워드' UNION ALL
  SELECT 'CATEGORY','베이커리','MEAL','CONTAINS',NULL,'RECEIPT',20,'베이커리/식비 키워드' UNION ALL
  SELECT 'CATEGORY','바게뜨','MEAL','CONTAINS',NULL,'RECEIPT',20,'베이커리/식비 키워드' UNION ALL
  SELECT 'CATEGORY','빵','MEAL','CONTAINS',NULL,'RECEIPT',20,'베이커리/식비 키워드' UNION ALL
  SELECT 'CATEGORY','소주','MEAL','CONTAINS',NULL,'RECEIPT',30,'음식점 영수증 내 주류는 식비 유지 후 비고 처리' UNION ALL
  SELECT 'CATEGORY','맥주','MEAL','CONTAINS',NULL,'RECEIPT',30,'음식점 영수증 내 주류는 식비 유지 후 비고 처리' UNION ALL
  SELECT 'CATEGORY','하이볼','MEAL','CONTAINS',NULL,'RECEIPT',30,'음식점 영수증 내 주류는 식비 유지 후 비고 처리' UNION ALL
  SELECT 'CATEGORY','참이슬','MEAL','CONTAINS',NULL,'RECEIPT',30,'음식점 영수증 내 주류는 식비 유지 후 비고 처리' UNION ALL
  SELECT 'CATEGORY','KTX','TRANSPORT','CONTAINS',NULL,'RECEIPT',10,'교통비 키워드' UNION ALL
  SELECT 'CATEGORY','코레일','TRANSPORT','CONTAINS',NULL,'RECEIPT',10,'교통비 키워드' UNION ALL
  SELECT 'CATEGORY','승차권','TRANSPORT','CONTAINS',NULL,'RECEIPT',10,'교통비 키워드' UNION ALL
  SELECT 'CATEGORY','시외버스','TRANSPORT','CONTAINS',NULL,'RECEIPT',10,'교통비 키워드' UNION ALL
  SELECT 'CATEGORY','고속버스','TRANSPORT','CONTAINS',NULL,'RECEIPT',10,'교통비 키워드' UNION ALL
  SELECT 'CATEGORY','터미널','TRANSPORT','CONTAINS',NULL,'RECEIPT',10,'교통비 키워드' UNION ALL
  SELECT 'CATEGORY','택시','TRANSPORT','CONTAINS',NULL,'RECEIPT',15,'교통비 키워드' UNION ALL
  SELECT 'CATEGORY','주차','TRANSPORT','CONTAINS',NULL,'RECEIPT',15,'교통비 키워드' UNION ALL
  SELECT 'CATEGORY','통행료','TRANSPORT','CONTAINS',NULL,'RECEIPT',15,'교통비 키워드' UNION ALL
  SELECT 'CATEGORY','하이패스','TRANSPORT','CONTAINS',NULL,'RECEIPT',15,'교통비 키워드' UNION ALL
  SELECT 'CATEGORY','다이소','SUPPLIES','CONTAINS',NULL,'RECEIPT',10,'소모품비 키워드' UNION ALL
  SELECT 'CATEGORY','문구','SUPPLIES','CONTAINS',NULL,'RECEIPT',15,'소모품비 키워드' UNION ALL
  SELECT 'CATEGORY','장갑','SUPPLIES','CONTAINS',NULL,'RECEIPT',15,'소모품비 키워드' UNION ALL
  SELECT 'CATEGORY','테이프','SUPPLIES','CONTAINS',NULL,'RECEIPT',15,'소모품비 키워드' UNION ALL
  SELECT 'CATEGORY','봉투','SUPPLIES','CONTAINS',NULL,'RECEIPT',20,'소모품비 키워드' UNION ALL
  SELECT 'CATEGORY','쇼핑백','SUPPLIES','CONTAINS',NULL,'RECEIPT',20,'소모품비 키워드' UNION ALL
  SELECT 'CATEGORY','티슈','SUPPLIES','CONTAINS',NULL,'RECEIPT',20,'소모품비 키워드' UNION ALL
  SELECT 'CATEGORY','물티슈','SUPPLIES','CONTAINS',NULL,'RECEIPT',20,'소모품비 키워드' UNION ALL
  SELECT 'CATEGORY','키친타올','SUPPLIES','CONTAINS',NULL,'RECEIPT',20,'소모품비 키워드' UNION ALL
  SELECT 'CATEGORY','핸드워시','SUPPLIES','CONTAINS',NULL,'RECEIPT',20,'소모품비 키워드'
) v
WHERE NOT EXISTS (
  SELECT 1 FROM correction_dictionaries cd
  WHERE cd.dictionary_type = v.dictionary_type
    AND cd.wrong_text = v.wrong_text
    AND cd.document_type = v.document_type
);

-- ---------------------------------------------------------
-- 2. correction_dictionaries: OCR_TEXT / ITEM / VENDOR 보정
-- ---------------------------------------------------------
INSERT INTO correction_dictionaries
(dictionary_type, wrong_text, corrected_text, match_type, min_similarity, document_type, priority, status, active_yn, suggested_by, description, created_by, approved_by, approved_at)
SELECT v.dictionary_type, v.wrong_text, v.corrected_text, v.match_type, v.min_similarity, v.document_type, v.priority, 'APPROVED', 'Y', 'SYSTEM', v.description, NULL, NULL, CURRENT_TIMESTAMP
FROM (
  SELECT 'OCR_TEXT' dictionary_type, '하이몰' wrong_text, '하이볼' corrected_text, 'CONTAINS' match_type, NULL min_similarity, 'RECEIPT' document_type, 10 priority, 'OCR 오인식 보정' description UNION ALL
  SELECT 'OCR_TEXT','패퍼로니','페퍼로니','CONTAINS',NULL,'RECEIPT',10,'OCR 오인식 보정' UNION ALL
  SELECT 'OCR_TEXT','원간','월간','CONTAINS',NULL,'RECEIPT',10,'OCR 오인식 보정' UNION ALL
  SELECT 'OCR_TEXT','얼그레','얼그레이','CONTAINS',NULL,'RECEIPT',10,'OCR 오인식 보정' UNION ALL
  SELECT 'OCR_TEXT','프넨치랙','프렌치랙','CONTAINS',NULL,'RECEIPT',10,'OCR 오인식 보정' UNION ALL
  SELECT 'OCR_TEXT','프렌치랙1개','프렌치랙 1개','CONTAINS',NULL,'RECEIPT',10,'OCR 붙은 문자열 보정' UNION ALL
  SELECT 'OCR_TEXT','징기스킨','징기스칸','CONTAINS',NULL,'RECEIPT',10,'OCR 오인식 보정' UNION ALL
  SELECT 'OCR_TEXT','양길미','양갈비','CONTAINS',NULL,'RECEIPT',10,'OCR 오인식 보정' UNION ALL
  SELECT 'OCR_TEXT','라무진','리무진','CONTAINS',NULL,'RECEIPT',10,'상호명 OCR 오인식 보정' UNION ALL
  SELECT 'OCR_TEXT','숲간계산서','중간계산서','CONTAINS',NULL,'RECEIPT',30,'문서 제목 OCR 오인식 보정' UNION ALL
  SELECT 'ITEM','하이몰','하이볼','CONTAINS',NULL,'RECEIPT',10,'품목명 보정' UNION ALL
  SELECT 'ITEM','패퍼로니','페퍼로니','CONTAINS',NULL,'RECEIPT',10,'품목명 보정' UNION ALL
  SELECT 'ITEM','프넨치랙','프렌치랙','CONTAINS',NULL,'RECEIPT',10,'품목명 보정' UNION ALL
  SELECT 'ITEM','징기스킨','징기스칸','CONTAINS',NULL,'RECEIPT',10,'품목명 보정' UNION ALL
  SELECT 'VENDOR','라무진나주혁신점','리무진 나주혁신점','CONTAINS',NULL,'RECEIPT',10,'상호명 보정' UNION ALL
  SELECT 'VENDOR','월간나주혁신도시점','월간 나주혁신도시점','CONTAINS',NULL,'RECEIPT',10,'상호명 공백 보정' UNION ALL
  SELECT 'PAYMENT','신용카드','카드','CONTAINS',NULL,'RECEIPT',10,'결제수단 표준화' UNION ALL
  SELECT 'PAYMENT','체크','카드','CONTAINS',NULL,'RECEIPT',20,'결제수단 표준화'
) v
WHERE NOT EXISTS (
  SELECT 1 FROM correction_dictionaries cd
  WHERE cd.dictionary_type = v.dictionary_type
    AND cd.wrong_text = v.wrong_text
    AND cd.document_type = v.document_type
);

-- ---------------------------------------------------------
-- 3. 문서유형 규칙 보강
-- ---------------------------------------------------------
INSERT INTO document_type_rules (document_type, keyword, match_type, score, active_yn)
SELECT v.document_type, v.keyword, v.match_type, v.score, 'Y'
FROM (
  SELECT 'ITEM_RECEIPT' document_type, '상품명' keyword, 'CONTAINS' match_type, 25 score UNION ALL
  SELECT 'ITEM_RECEIPT', '품명', 'CONTAINS', 20 UNION ALL
  SELECT 'ITEM_RECEIPT', '단가', 'CONTAINS', 15 UNION ALL
  SELECT 'ITEM_RECEIPT', '수량', 'CONTAINS', 15 UNION ALL
  SELECT 'ITEM_RECEIPT', '금액', 'CONTAINS', 15 UNION ALL
  SELECT 'ITEM_RECEIPT', '테이블', 'CONTAINS', 10 UNION ALL
  SELECT 'TRANSPORT_RECEIPT', '운임', 'CONTAINS', 20 UNION ALL
  SELECT 'TRANSPORT_RECEIPT', '승차일', 'CONTAINS', 20 UNION ALL
  SELECT 'TRANSPORT_RECEIPT', '좌석', 'CONTAINS', 15
) v
WHERE NOT EXISTS (
  SELECT 1 FROM document_type_rules dtr
  WHERE dtr.document_type = v.document_type
    AND dtr.keyword = v.keyword
);

-- ---------------------------------------------------------
-- 4. 섹션 규칙 보강: 품목 영역 종료/제외/결제 라인
-- ---------------------------------------------------------
INSERT INTO document_section_rules (document_type, section_type, keyword, match_type, target_field_key, priority, active_yn)
SELECT v.document_type, v.section_type, v.keyword, v.match_type, v.target_field_key, v.priority, 'Y'
FROM (
  SELECT 'ITEM_RECEIPT' document_type, 'ITEM_START' section_type, '상품명' keyword, 'CONTAINS' match_type, 'item_name' target_field_key, 10 priority UNION ALL
  SELECT 'ITEM_RECEIPT','ITEM_START','품명','CONTAINS','item_name',20 UNION ALL
  SELECT 'ITEM_RECEIPT','ITEM_END','일 계','CONTAINS','total_amount',25 UNION ALL
  SELECT 'ITEM_RECEIPT','ITEM_END','일계','CONTAINS','total_amount',25 UNION ALL
  SELECT 'ITEM_RECEIPT','ITEM_END','주문자','CONTAINS',NULL,30 UNION ALL
  SELECT 'ITEM_RECEIPT','ITEM_END','고객수','CONTAINS',NULL,31 UNION ALL
  SELECT 'ITEM_RECEIPT','SUMMARY','일 계','CONTAINS','total_amount',25 UNION ALL
  SELECT 'ITEM_RECEIPT','SUMMARY','일계','CONTAINS','total_amount',25 UNION ALL
  SELECT 'ITEM_RECEIPT','PAYMENT','신용카드','CONTAINS','payment_method',15 UNION ALL
  SELECT 'ITEM_RECEIPT','PAYMENT','승인일시','CONTAINS','approval_time',35 UNION ALL
  SELECT 'ITEM_RECEIPT','EXCLUDE','신용승인정보','CONTAINS',NULL,10 UNION ALL
  SELECT 'ITEM_RECEIPT','EXCLUDE','카드번호','CONTAINS',NULL,10 UNION ALL
  SELECT 'ITEM_RECEIPT','EXCLUDE','가맹점 번호','CONTAINS',NULL,10 UNION ALL
  SELECT 'ITEM_RECEIPT','EXCLUDE','사업자','CONTAINS',NULL,10 UNION ALL
  SELECT 'ITEM_RECEIPT','EXCLUDE','주소','CONTAINS',NULL,20 UNION ALL
  SELECT 'ITEM_RECEIPT','EXCLUDE','주문자','CONTAINS',NULL,20 UNION ALL
  SELECT 'ITEM_RECEIPT','EXCLUDE','고객수','CONTAINS',NULL,20
) v
WHERE NOT EXISTS (
  SELECT 1 FROM document_section_rules dsr
  WHERE dsr.document_type = v.document_type
    AND dsr.section_type = v.section_type
    AND dsr.keyword = v.keyword
);

-- ---------------------------------------------------------
-- 5. 검증 규칙 기준 정합화
--    품목형 영수증은 상세합계와 기준금액이 다르면 자동 PASS 금지.
-- ---------------------------------------------------------
UPDATE validation_rules
SET condition_json = JSON_OBJECT('item_amount_field', 'amount', 'total_field', 'total_amount', 'tolerance', 0),
    severity = 'ERROR',
    is_active = TRUE
WHERE rule_code = 'ITEM_SUM_TOTAL_CHECK';

UPDATE validation_rules
SET condition_json = JSON_OBJECT('min_confidence', 0.80),
    severity = 'WARNING',
    is_active = TRUE
WHERE rule_code = 'LOW_CONFIDENCE';

-- ---------------------------------------------------------
-- 6. 적용 확인
-- ---------------------------------------------------------
SELECT 'correction_dictionaries_APPROVED_ACTIVE' AS name, COUNT(*) AS cnt
FROM correction_dictionaries
WHERE status = 'APPROVED' AND active_yn = 'Y'
UNION ALL
SELECT 'document_type_rules_ACTIVE', COUNT(*)
FROM document_type_rules
WHERE active_yn = 'Y'
UNION ALL
SELECT 'document_section_rules_ACTIVE', COUNT(*)
FROM document_section_rules
WHERE active_yn = 'Y'
UNION ALL
SELECT 'validation_rules_ACTIVE', COUNT(*)
FROM validation_rules
WHERE is_active = TRUE;


-- =========================================================
-- APPENDED PATCH 2: DB Rule Context 확장 Seed
-- =========================================================

-- =========================================================
-- DB Rule Context Extended Seed / Patch
-- 생성일: 2026-06-16
-- 목적:
--   1) 기존 최소형 DB Rule Context seed의 부족한 카테고리/보정/문서유형/섹션/검증 규칙을 확장
--   2) 추가 화면 없이 기존 correction_dictionaries, document_type_rules, document_section_rules, validation_rules 사용
--   3) 중복 실행해도 기존 데이터와 충돌하지 않도록 NOT EXISTS 기준으로 삽입
-- 주의:
--   - 특정 영수증의 가격/품목 결과를 강제하지 않습니다.
--   - 카테고리/보정/제외/검증 기준 데이터를 보강하는 seed입니다.
-- =========================================================

-- ---------------------------------------------------------
-- 0. 경비 카테고리 기준 보강
-- ---------------------------------------------------------
INSERT INTO expense_categories (category_code, category_name, description, is_active)
SELECT 'MEAL', '식비', '식사, 회식, 카페, 베이커리 등 식음료 관련 비용', TRUE
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE category_code = 'MEAL');
INSERT INTO expense_categories (category_code, category_name, description, is_active)
SELECT 'TRANSPORT', '교통비', 'KTX, SRT, 버스, 택시, 주차, 통행료 등 이동 관련 비용', TRUE
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE category_code = 'TRANSPORT');
INSERT INTO expense_categories (category_code, category_name, description, is_active)
SELECT 'LODGING', '숙박비', '호텔, 모텔, 리조트, 펜션 등 숙박 관련 비용', TRUE
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE category_code = 'LODGING');
INSERT INTO expense_categories (category_code, category_name, description, is_active)
SELECT 'SUPPLIES', '소모품비', '현장/사무 소모품 구매 비용', TRUE
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE category_code = 'SUPPLIES');
INSERT INTO expense_categories (category_code, category_name, description, is_active)
SELECT 'FUEL', '유류비', '휘발유, 경유, LPG, 전기차 충전 등 차량 연료 비용', TRUE
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE category_code = 'FUEL');
INSERT INTO expense_categories (category_code, category_name, description, is_active)
SELECT 'COMMUNICATION', '통신비', '휴대폰, 인터넷, 통신 요금 관련 비용', TRUE
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE category_code = 'COMMUNICATION');
INSERT INTO expense_categories (category_code, category_name, description, is_active)
SELECT 'MATERIAL', '자재비', '공사/현장 자재 및 공구 구매 비용', TRUE
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE category_code = 'MATERIAL');
INSERT INTO expense_categories (category_code, category_name, description, is_active)
SELECT 'ETC', '기타', '분류가 어려운 기타 비용', TRUE
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE category_code = 'ETC');

-- ---------------------------------------------------------
-- 1. correction_dictionaries 확장: CATEGORY 키워드
-- ---------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_rule_category_seed;
CREATE TEMPORARY TABLE tmp_rule_category_seed (dictionary_type VARCHAR(50), wrong_text VARCHAR(255), corrected_text VARCHAR(255), match_type VARCHAR(30), min_similarity DECIMAL(5,4) NULL, document_type VARCHAR(50), priority INT, description TEXT) ENGINE=InnoDB;
INSERT INTO tmp_rule_category_seed (dictionary_type, wrong_text, corrected_text, match_type, min_similarity, document_type, priority, description) VALUES
('CATEGORY', '음식점', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '식당', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '한식', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '중식', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '일식', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '양식', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '분식', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '뷔페', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '레스토랑', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '푸드코트', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '구내식당', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '식권', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '식대', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '식사', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '점심', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '저녁', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '조식', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '중식대', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '석식', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '회식', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '도시락', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '김밥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '라면', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '우동', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '라멘', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '냉면', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '국수', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '칼국수', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '쌀국수', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '짜장', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '짬뽕', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '탕수육', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '마라탕', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '마라샹궈', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '국밥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '순대국', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '설렁탕', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '곰탕', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '해장국', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '백반', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '찌개', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '김치찌개', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '된장찌개', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '부대찌개', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '전골', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '감자탕', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '해물탕', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '삼계탕', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '비빔밥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '덮밥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '볶음밥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '마늘밥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '공기밥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '돈까스', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '돈가스', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '제육', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '불고기', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '보쌈', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '족발', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '치킨', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '닭갈비', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '닭강정', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '삼겹살', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '목살', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '갈비', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '양갈비', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '프렌치랙', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '소고기', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '돼지고기', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '양고기', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '고기집', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '고깃집', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '정육식당', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '구이', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '곱창', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '막창', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '대창', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '초밥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '스시', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '사시미', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '참치', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '해산물', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '조개구이', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '생선구이', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '장어', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '아구찜', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '찜닭', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '피자', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '파스타', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '스테이크', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '햄버거', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '버거', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '샌드위치', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '샐러드', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '감바스', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '리조또', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '필라프', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '타코', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '브리또', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '카페', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '커피', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '아메리카노', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '카페라떼', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '라떼', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '카푸치노', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '에스프레소', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '콜드브루', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '디카페인', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '에이드', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '스무디', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '프라페', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '차이티', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '티라떼', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '베이커리', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '제과', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '제빵', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '파리바게뜨', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '파리바게트', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '뚜레쥬르', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '성심당', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '브레댄코', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '케이크', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '도넛', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '크로와상', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '소주', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류 키워드: 식비 유지 후 비고/검토 처리'),
('CATEGORY', '맥주', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류 키워드: 식비 유지 후 비고/검토 처리'),
('CATEGORY', '생맥주', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류 키워드: 식비 유지 후 비고/검토 처리'),
('CATEGORY', '참이슬', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류 키워드: 식비 유지 후 비고/검토 처리'),
('CATEGORY', '처음처럼', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류 키워드: 식비 유지 후 비고/검토 처리'),
('CATEGORY', '테라', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류 키워드: 식비 유지 후 비고/검토 처리'),
('CATEGORY', '카스', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류 키워드: 식비 유지 후 비고/검토 처리'),
('CATEGORY', '켈리', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류 키워드: 식비 유지 후 비고/검토 처리'),
('CATEGORY', '하이트', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류 키워드: 식비 유지 후 비고/검토 처리'),
('CATEGORY', '막걸리', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류 키워드: 식비 유지 후 비고/검토 처리'),
('CATEGORY', '와인', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류 키워드: 식비 유지 후 비고/검토 처리'),
('CATEGORY', '하이볼', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류 키워드: 식비 유지 후 비고/검토 처리'),
('CATEGORY', '칵테일', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류 키워드: 식비 유지 후 비고/검토 처리'),
('CATEGORY', '코젤', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류 키워드: 식비 유지 후 비고/검토 처리'),
('CATEGORY', '코젤다크', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류 키워드: 식비 유지 후 비고/검토 처리'),
('CATEGORY', '청하', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류 키워드: 식비 유지 후 비고/검토 처리'),
('CATEGORY', '매화수', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류 키워드: 식비 유지 후 비고/검토 처리'),
('CATEGORY', '사케', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류 키워드: 식비 유지 후 비고/검토 처리'),
('CATEGORY', 'KTX', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', 'SRT', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', 'ITX', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '새마을', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '무궁화', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '누리로', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '코레일', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', 'KORAIL', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '열차', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '기차', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '승차권', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '승차표', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '승차일', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '승차일시', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '승차권번호', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '좌석', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '호차', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '운임', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '출발', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '도착', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '출발지', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '도착지', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '동서울', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '고속터미널', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '터미널', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '시외버스', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '고속버스', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '공항버스', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '버스승차권', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '버스표', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '승차홈', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '택시', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '카카오T', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '카카오티', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '티머니', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '캐시비', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '교통카드', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '지하철', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '전철', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '환승', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '주차', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '주차장', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '주차요금', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '공영주차', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '민영주차', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '통행료', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '하이패스', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '고속도로', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '톨게이트', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '터널통행료', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '도로공사', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '공항철도', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '리무진버스', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '대리운전', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '카셰어링', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '렌터카', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '렌트카', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 강한 키워드'),
('CATEGORY', '호텔', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '모텔', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '숙박', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '숙소', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '여관', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '리조트', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '펜션', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '게스트하우스', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '콘도', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '호스텔', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '캡슐호텔', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '객실', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '체크인', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '체크아웃', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '룸차지', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '숙박비', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '야놀자', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '여기어때', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '아고다', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '부킹닷컴', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '에어비앤비', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '호텔스컴바인', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '트립닷컴', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '익스피디아', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '레지던스', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '비즈니스호텔', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '관광호텔', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 강한 키워드'),
('CATEGORY', '다이소', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '국민가게다이소', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '아성다이소', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '문구', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '문구점', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '사무용품', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '오피스디포', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '오피스넥스', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '알파문구', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '모닝글로리', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '아트박스', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '볼펜', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '펜', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '연필', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '지우개', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '형광펜', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '네임펜', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '마커', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '화이트보드마커', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', 'A4', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '복사용지', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '용지', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '포스트잇', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '메모지', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '노트', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '수첩', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '클립', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '스테이플러', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '스템플러', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '스테이플', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '제본', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '파일', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '바인더', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '서류철', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '봉투', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '쇼핑백', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '종이컵', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '일회용컵', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '빨대', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '물티슈', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '티슈', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '키친타올', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '화장지', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '휴지', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '핸드워시', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '손소독제', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '세제', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '청소포', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '청소용품', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '쓰레기봉투', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '비닐봉투', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '마대', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '걸레', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '빗자루', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '마스크', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '면장갑', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '코팅장갑', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '작업장갑', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '장갑', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '안전장갑', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '테이프', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '박스테이프', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '양면테이프', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '청테이프', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '전기테이프', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '케이블타이', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '건전지', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '배터리', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '멀티탭', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '연장선', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '충전기', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', 'USB케이블', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '랜선', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', 'HDMI', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '어댑터', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '마우스', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '키보드', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '잉크', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '토너', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '프린터용지', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '라벨지', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '라벨테이프', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '택배박스', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '포장재', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '완충재', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '뽁뽁이', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '커터칼', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '칼날', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '가위', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '줄자', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '계산기', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 강한 키워드'),
('CATEGORY', '주유', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', '주유소', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', '휘발유', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', '경유', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', '고급휘발유', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', '등유', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', 'LPG', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', '가스충전', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', '충전소', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', '전기차충전', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', 'EV충전', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', '수소충전', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', 'GS칼텍스', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', 'SK에너지', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', 'SK주유소', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', 'S-OIL', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', '에쓰오일', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', '현대오일뱅크', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', 'HD현대오일뱅크', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', '알뜰주유소', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', '농협주유소', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', 'E1', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', 'SK가스', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', '오피넷', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', '셀프주유', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', '리터', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', '연료', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 강한 키워드'),
('CATEGORY', '통신비', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', '통신요금', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', '휴대폰요금', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', '핸드폰요금', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', '전화요금', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', '인터넷요금', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', '인터넷', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', '와이파이', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', '데이터요금', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', '유심', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', 'USIM', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', '알뜰폰', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', '케이티', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', 'SKT', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', 'SK텔레콤', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', 'LGU+', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', 'LG유플러스', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', '유플러스', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', '헬로모바일', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', '스카이라이프', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', '요금납부', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', '통화료', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', '문자요금', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', '로밍', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', '공유기', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', '모뎀', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 강한 키워드'),
('CATEGORY', '자재', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '건자재', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '철물', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '철물점', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '공구', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '공구상', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '전동공구', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '수공구', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '드릴', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '그라인더', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '렌치', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '스패너', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '망치', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '톱', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '피스', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '못', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '나사', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '볼트', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '너트', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '와셔', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '앙카', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '앵커', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '타카핀', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '케미칼앙카', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '전선', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '케이블', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', 'CV전선', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', 'F-CV', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', 'VCTF', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '랜케이블', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '배선', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '전기자재', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '차단기', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '분전반', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '콘센트', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '스위치', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '플러그', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', 'LED', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '전구', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '형광등', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '등기구', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '조명', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '접지', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '단자', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '압착단자', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '수축튜브', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '절연테이프', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '배관', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '파이프', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', 'PVC', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', 'CD관', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', 'ELP관', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '전선관', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '수도관', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '호스', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '밸브', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '소켓', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '엘보', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '티', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '니플', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '유니온', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '플랜지', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '부속', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '배관부속', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '보온재', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '시멘트', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '몰탈', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '모르타르', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '레미콘', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '모래', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '자갈', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '벽돌', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '블럭', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '블록', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '철근', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', 'H빔', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '각관', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '철판', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '아연판', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '스텐', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '스테인리스', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '알루미늄', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '목재', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '합판', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '각재', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '석고보드', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '텍스', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '천장재', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '단열재', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '우레탄폼', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '실리콘', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '실란트', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '코킹', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '본드', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '접착제', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '에폭시', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '페인트', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '락카', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '프라이머', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '방수재', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '타일', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '타일본드', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '줄눈', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '방수테이프', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '보양재', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '보양비닐', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '방진망', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '안전모', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '안전화', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '안전벨트', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '안전조끼', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '라바콘', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '안전표지판', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드'),
('CATEGORY', '위험표지', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비/현장 구매 강한 키워드');
INSERT INTO correction_dictionaries (dictionary_type, wrong_text, corrected_text, match_type, min_similarity, document_type, priority, status, active_yn, suggested_by, description, created_by, approved_by, approved_at)
SELECT s.dictionary_type, s.wrong_text, s.corrected_text, s.match_type, s.min_similarity, s.document_type, s.priority, 'APPROVED', 'Y', 'SYSTEM', s.description, NULL, NULL, CURRENT_TIMESTAMP
FROM tmp_rule_category_seed s
WHERE NOT EXISTS (
  SELECT 1 FROM correction_dictionaries cd
  WHERE cd.dictionary_type = s.dictionary_type
    AND cd.wrong_text = s.wrong_text
    AND cd.document_type = s.document_type
);
DROP TEMPORARY TABLE IF EXISTS tmp_rule_category_seed;

-- ---------------------------------------------------------
-- 2. correction_dictionaries 확장: OCR_TEXT / ITEM / VENDOR / PAYMENT 보정
-- ---------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_rule_correction_seed;
CREATE TEMPORARY TABLE tmp_rule_correction_seed (dictionary_type VARCHAR(50), wrong_text VARCHAR(255), corrected_text VARCHAR(255), match_type VARCHAR(30), min_similarity DECIMAL(5,4) NULL, document_type VARCHAR(50), priority INT, description TEXT) ENGINE=InnoDB;
INSERT INTO tmp_rule_correction_seed (dictionary_type, wrong_text, corrected_text, match_type, min_similarity, document_type, priority, description) VALUES
('OCR_TEXT', '영수중', '영수증', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '영수증', '영수증', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '영수즘', '영수증', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '게산서', '계산서', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '계산셔', '계산서', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '중간계산 ', '중간계산서', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '숲간계산서', '중간계산서', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '중간계산서77', '중간계산서', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '상 품 명', '상품명', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '싱품명', '상품명', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '상품멍', '상품명', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '품 목', '품목', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '품 명', '품명', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '단 가', '단가', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '수 량', '수량', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '수랑', '수량', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '힐인', '할인', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '힘인', '할인', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '그액', '금액', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '금의', '금액', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '금맥', '금액', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '합게', '합계', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '항계', '합계', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '일 계', '일계', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '총 계', '총계', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '공급가액', '공급가액', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '공급가엑', '공급가액', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '부가셰', '부가세', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '부가가치셰', '부가가치세', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '과셰', '과세', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '면셰', '면세', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '결제금약', '결제금액', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '승인금약', '승인금액', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '신용카드', '신용카드', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '신용카드드', '신용카드', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '일시물', '일시불', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '카드번효', '카드번호', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '승인번효', '승인번호', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '가맹점 번효', '가맹점 번호', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '매잠', '매장', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '매장멍', '매장명', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '가맹전', '가맹점', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '사업자등륵번호', '사업자등록번호', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '대표차', '대표자', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '전 화', '전화', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', 'TEL.', 'TEL', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', 'TEl', 'TEL', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '배옛', '배멧', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '빚가람동', '빛가람동', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '빛가람등', '빛가람동', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '나주시배멧', '나주시 배멧', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '배멧1길26-1', '배멧1길 26-1', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '92,''200', '92,200', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '000''8', '8,000', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '000''9', '9,000', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '000''28', '82,000', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', 'o 6,000', '0 6,000', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', 'O 6,000', '0 6,000', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', 'o 12,000', '0 12,000', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', 'O 12,000', '0 12,000', 'CONTAINS', NULL, 'RECEIPT', 5, '공통 OCR 문구/금액/라벨 보정'),
('OCR_TEXT', '하이몰', '하이볼', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '하이롤', '하이볼', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '하이블', '하이볼', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '하이볼류', '하이볼', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '얼그레', '얼그레이', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '피치 얼그레', '피치 얼그레이', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '자몽 하이몰', '자몽 하이볼', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '모히또 하이', '모히또 하이볼', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '패퍼로니', '페퍼로니', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '페파로니', '페퍼로니', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '크림치즈 꽃감말이', '크림치즈 곶감말이', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '꽃감말이', '곶감말이', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '감바스 알 아히', '감바스 알 아히요', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '감바스 알 아히오', '감바스 알 아히요', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '프넨치랙', '프렌치랙', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '프랜치랙', '프렌치랙', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '프렌치랙1개', '프렌치랙 1개', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '징기스킨', '징기스칸', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '징기스간', '징기스칸', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '징기스칸양길미', '징기스칸 양갈비', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '양길미', '양갈비', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '양길비', '양갈비', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '양갈미', '양갈비', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '라무진', '리무진', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '라무진나주혁신점', '리무진 나주혁신점', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '리무진나주혁신점', '리무진 나주혁신점', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '월간나주혁신도시점', '월간 나주혁신도시점', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '원간 나주혁신도시점', '월간 나주혁신도시점', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '원간', '월간', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '맥먹드익스프레스', '매머드 익스프레스', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '맥머드익스프레스', '매머드 익스프레스', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '메머드익스프레스', '매머드 익스프레스', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '매머드익스프레스', '매머드 익스프레스', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '파리바게트', '파리바게뜨', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', 'PARISBAGUETTE', '파리바게뜨', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', 'ParisBaguette', '파리바게뜨', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '광주서석파리바게뜨', '파리바게뜨', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '송림전집', '송림전집', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '승림전집', '송림전집', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '송림전침', '송림전집', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '송림전칩', '송림전집', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('OCR_TEXT', '전집', '전집', 'CONTAINS', NULL, 'RECEIPT', 10, '테스트 및 일반 영수증 OCR 오인식 보정'),
('ITEM', '하이몰', '하이볼', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '하이롤', '하이볼', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '얼그레', '얼그레이', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '패퍼로니', '페퍼로니', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '페파로니', '페퍼로니', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '프넨치랙', '프렌치랙', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '프랜치랙', '프렌치랙', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '징기스킨', '징기스칸', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '양길미', '양갈비', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '양길비', '양갈비', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '크림치즈 꽃감말이', '크림치즈 곶감말이', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '꽃감말이', '곶감말이', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '감바스 알 아히', '감바스 알 아히요', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '마늘발', '마늘밥', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '마늘방', '마늘밥', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '두부김지', '두부김치', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '두부김차', '두부김치', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '아메리카노 HOT', '아메리카노', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '아메리카노 ICE', '아메리카노', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '아아', '아이스 아메리카노', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '카페라데', '카페라떼', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '라테', '라떼', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '쇼핑백대', '쇼핑백', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '쇼핑백소', '쇼핑백', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '봉투대', '봉투', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('ITEM', '봉투소', '봉투', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 보정'),
('VENDOR', '라무진나주혁신점', '리무진 나주혁신점', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 보정'),
('VENDOR', '리무진나주혁신점', '리무진 나주혁신점', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 보정'),
('VENDOR', '월간나주혁신도시점', '월간 나주혁신도시점', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 보정'),
('VENDOR', '원간나주혁신도시점', '월간 나주혁신도시점', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 보정'),
('VENDOR', '맥먹드익스프레스', '매머드 익스프레스', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 보정'),
('VENDOR', '맥머드익스프레스', '매머드 익스프레스', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 보정'),
('VENDOR', '메머드익스프레스', '매머드 익스프레스', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 보정'),
('VENDOR', '국민가게다이소', '다이소', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 보정'),
('VENDOR', '아성다이소', '다이소', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 보정'),
('VENDOR', '파리바게트', '파리바게뜨', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 보정'),
('VENDOR', 'PARISBAGUETTE', '파리바게뜨', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 보정'),
('VENDOR', '송림전집', '송림전집', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 보정'),
('VENDOR', '승림전집', '송림전집', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 보정'),
('VENDOR', '코레일네트웍스', '코레일', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 보정'),
('VENDOR', '한국철도공사', '코레일', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 보정'),
('PAYMENT', '신용카드', '카드', 'CONTAINS', NULL, 'RECEIPT', 10, '결제수단 표준화'),
('PAYMENT', '체크카드', '카드', 'CONTAINS', NULL, 'RECEIPT', 10, '결제수단 표준화'),
('PAYMENT', '신한체크', '카드', 'CONTAINS', NULL, 'RECEIPT', 10, '결제수단 표준화'),
('PAYMENT', '카드결제', '카드', 'CONTAINS', NULL, 'RECEIPT', 10, '결제수단 표준화'),
('PAYMENT', '카드승인', '카드', 'CONTAINS', NULL, 'RECEIPT', 10, '결제수단 표준화'),
('PAYMENT', '현금결제', '현금', 'CONTAINS', NULL, 'RECEIPT', 10, '결제수단 표준화'),
('PAYMENT', '현금영수증', '현금', 'CONTAINS', NULL, 'RECEIPT', 10, '결제수단 표준화'),
('PAYMENT', '간편결제', '간편결제', 'CONTAINS', NULL, 'RECEIPT', 10, '결제수단 표준화'),
('PAYMENT', '카카오페이', '간편결제', 'CONTAINS', NULL, 'RECEIPT', 10, '결제수단 표준화'),
('PAYMENT', '네이버페이', '간편결제', 'CONTAINS', NULL, 'RECEIPT', 10, '결제수단 표준화'),
('PAYMENT', '페이코', '간편결제', 'CONTAINS', NULL, 'RECEIPT', 10, '결제수단 표준화'),
('PAYMENT', '제로페이', '간편결제', 'CONTAINS', NULL, 'RECEIPT', 10, '결제수단 표준화');
INSERT INTO correction_dictionaries (dictionary_type, wrong_text, corrected_text, match_type, min_similarity, document_type, priority, status, active_yn, suggested_by, description, created_by, approved_by, approved_at)
SELECT s.dictionary_type, s.wrong_text, s.corrected_text, s.match_type, s.min_similarity, s.document_type, s.priority, 'APPROVED', 'Y', 'SYSTEM', s.description, NULL, NULL, CURRENT_TIMESTAMP
FROM tmp_rule_correction_seed s
WHERE NOT EXISTS (
  SELECT 1 FROM correction_dictionaries cd
  WHERE cd.dictionary_type = s.dictionary_type
    AND cd.wrong_text = s.wrong_text
    AND cd.document_type = s.document_type
);
DROP TEMPORARY TABLE IF EXISTS tmp_rule_correction_seed;

-- ---------------------------------------------------------
-- 3. document_type_rules 확장
-- ---------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_document_type_rule_seed;
CREATE TEMPORARY TABLE tmp_document_type_rule_seed (document_type VARCHAR(50), keyword VARCHAR(100), match_type VARCHAR(30), score INT) ENGINE=InnoDB;
INSERT INTO tmp_document_type_rule_seed (document_type, keyword, match_type, score) VALUES
('ITEM_RECEIPT', '상품명', 'CONTAINS', 20),
('ITEM_RECEIPT', '상 품 명', 'CONTAINS', 20),
('ITEM_RECEIPT', '품명', 'CONTAINS', 20),
('ITEM_RECEIPT', '품 목', 'CONTAINS', 20),
('ITEM_RECEIPT', '단가', 'CONTAINS', 20),
('ITEM_RECEIPT', '단 가', 'CONTAINS', 20),
('ITEM_RECEIPT', '수량', 'CONTAINS', 20),
('ITEM_RECEIPT', '수 량', 'CONTAINS', 20),
('ITEM_RECEIPT', '할인', 'CONTAINS', 20),
('ITEM_RECEIPT', '금액', 'CONTAINS', 20),
('ITEM_RECEIPT', '합계금액', 'CONTAINS', 20),
('ITEM_RECEIPT', '판매합계', 'CONTAINS', 20),
('ITEM_RECEIPT', '일계', 'CONTAINS', 20),
('ITEM_RECEIPT', '일 계', 'CONTAINS', 20),
('ITEM_RECEIPT', '테이블', 'CONTAINS', 20),
('ITEM_RECEIPT', '주문자', 'CONTAINS', 20),
('ITEM_RECEIPT', '고객수', 'CONTAINS', 20),
('ITEM_RECEIPT', '영수증', 'CONTAINS', 20),
('ITEM_RECEIPT', '계산서', 'CONTAINS', 20),
('ITEM_RECEIPT', '중간계산서', 'CONTAINS', 20),
('ITEM_RECEIPT', '메뉴', 'CONTAINS', 20),
('ITEM_RECEIPT', '메뉴명', 'CONTAINS', 20),
('TRANSPORT_RECEIPT', 'KTX', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', 'SRT', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '코레일', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', 'KORAIL', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '승차권', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '승차일', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '승차일시', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '출발', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '도착', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '좌석', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '호차', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '열차', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '운임', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '시외버스', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '고속버스', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '터미널', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '승차홈', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '버스승차권', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '티머니', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '택시', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '카카오T', 'CONTAINS', 25),
('CARD_RECEIPT', '승인번호', 'CONTAINS', 20),
('CARD_RECEIPT', '카드번호', 'CONTAINS', 20),
('CARD_RECEIPT', '승인금액', 'CONTAINS', 20),
('CARD_RECEIPT', '승인일시', 'CONTAINS', 20),
('CARD_RECEIPT', '신용승인정보', 'CONTAINS', 20),
('CARD_RECEIPT', '가맹점번호', 'CONTAINS', 20),
('CARD_RECEIPT', '카드회원번호', 'CONTAINS', 20),
('CARD_RECEIPT', '매입사', 'CONTAINS', 20),
('CARD_RECEIPT', '발급사', 'CONTAINS', 20),
('CARD_RECEIPT', '할부', 'CONTAINS', 20),
('CARD_RECEIPT', '일시불', 'CONTAINS', 20),
('TRANSACTION_STATEMENT', '거래명세서', 'CONTAINS', 25),
('TRANSACTION_STATEMENT', '거래명세표', 'CONTAINS', 25),
('TRANSACTION_STATEMENT', '공급자', 'CONTAINS', 25),
('TRANSACTION_STATEMENT', '공급받는자', 'CONTAINS', 25),
('TRANSACTION_STATEMENT', '품목', 'CONTAINS', 25),
('TRANSACTION_STATEMENT', '규격', 'CONTAINS', 25),
('TRANSACTION_STATEMENT', '수량', 'CONTAINS', 25),
('TRANSACTION_STATEMENT', '단가', 'CONTAINS', 25),
('TRANSACTION_STATEMENT', '공급가액', 'CONTAINS', 25),
('TRANSACTION_STATEMENT', '세액', 'CONTAINS', 25),
('TRANSACTION_STATEMENT', '합계금액', 'CONTAINS', 25),
('DELIVERY_NOTE', '납품서', 'CONTAINS', 25),
('DELIVERY_NOTE', '납품일자', 'CONTAINS', 25),
('DELIVERY_NOTE', '납품장소', 'CONTAINS', 25),
('DELIVERY_NOTE', '인수자', 'CONTAINS', 25),
('DELIVERY_NOTE', '납품번호', 'CONTAINS', 25),
('DELIVERY_NOTE', '발주번호', 'CONTAINS', 25),
('DELIVERY_NOTE', '창고', 'CONTAINS', 25),
('DELIVERY_NOTE', '입고', 'CONTAINS', 25),
('MATERIAL_INSPECTION', '자재검수', 'CONTAINS', 25),
('MATERIAL_INSPECTION', '검수일자', 'CONTAINS', 25),
('MATERIAL_INSPECTION', '검수결과', 'CONTAINS', 25),
('MATERIAL_INSPECTION', '합격수량', 'CONTAINS', 25),
('MATERIAL_INSPECTION', '불량수량', 'CONTAINS', 25),
('MATERIAL_INSPECTION', '입고창고', 'CONTAINS', 25),
('MATERIAL_INSPECTION', '검수자', 'CONTAINS', 25),
('DAILY_REPORT', '작업일보', 'CONTAINS', 25),
('DAILY_REPORT', '작업일자', 'CONTAINS', 25),
('DAILY_REPORT', '작업내용', 'CONTAINS', 25),
('DAILY_REPORT', '작업인원', 'CONTAINS', 25),
('DAILY_REPORT', '장비', 'CONTAINS', 25),
('DAILY_REPORT', '공정률', 'CONTAINS', 25),
('DAILY_REPORT', '날씨', 'CONTAINS', 25),
('DAILY_REPORT', '현장명', 'CONTAINS', 25);
INSERT INTO document_type_rules (document_type, keyword, match_type, score, active_yn)
SELECT s.document_type, s.keyword, s.match_type, s.score, 'Y'
FROM tmp_document_type_rule_seed s
WHERE NOT EXISTS (
  SELECT 1 FROM document_type_rules dtr
  WHERE dtr.document_type = s.document_type
    AND dtr.keyword = s.keyword
);
DROP TEMPORARY TABLE IF EXISTS tmp_document_type_rule_seed;

-- ---------------------------------------------------------
-- 4. document_section_rules 확장
-- ---------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_document_section_rule_seed;
CREATE TEMPORARY TABLE tmp_document_section_rule_seed (document_type VARCHAR(50), section_type VARCHAR(30), keyword VARCHAR(100), match_type VARCHAR(30), target_field_key VARCHAR(100) NULL, priority INT) ENGINE=InnoDB;
INSERT INTO tmp_document_section_rule_seed (document_type, section_type, keyword, match_type, target_field_key, priority) VALUES
('ITEM_RECEIPT', 'ITEM_START', '상품명', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '상 품 명', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '품명', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '품 목', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '품목명', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '메뉴명', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '내역', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '구매품목', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '판매상품', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '주문내역', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_END', '합계', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '합 계', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '합계금액', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '판매합계', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '총합계', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '총 계', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '일계', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '일 계', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '받을금액', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '결제금액', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '청구금액', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '공급가액', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '부가세', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '과세', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '면세', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '할인합계', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '주문자', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '고객수', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '신용승인정보', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '카드승인정보', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'SUMMARY', '합계', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'SUMMARY', '합계금액', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'SUMMARY', '판매합계', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'SUMMARY', '총합계', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'SUMMARY', '일계', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'SUMMARY', '일 계', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'SUMMARY', '받을금액', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'SUMMARY', '결제금액', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'SUMMARY', '승인금액', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'SUMMARY', '공급가액', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'SUMMARY', '부가세', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'SUMMARY', '부가가치세', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'SUMMARY', '과세금액', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'SUMMARY', '면세금액', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'SUMMARY', '총수량', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'PAYMENT', '신용카드', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '체크카드', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '카드', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '현금', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '현금영수증', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '간편결제', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '카카오페이', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '네이버페이', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '승인번호', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '승인일시', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '카드번호', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '가맹점번호', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '할부', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '일시불', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '매입사', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '발급사', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'DISCOUNT', '할인', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'DISCOUNT', '에누리', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'DISCOUNT', '쿠폰', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'DISCOUNT', '포인트', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'DISCOUNT', '적립', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'DISCOUNT', '멤버십', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'DISCOUNT', '마일리지', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'DISCOUNT', '거스름돈', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'DISCOUNT', '잔돈', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'DISCOUNT', '받은금액', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'DISCOUNT', '거래후잔액', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'EXCLUDE', '사업자', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '사업자등록번호', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '등록번호', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '대표자', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '주소', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '전화', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', 'TEL', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '매장명', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '가맹점', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '가맹점번호', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '주문자', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '고객수', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '테이블', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '영수증번호', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '전표번호', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '영수증', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '중간계산서', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '신용승인정보', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '카드승인정보', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '카드번호', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '카드회원번호', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '승인번호', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '승인일시', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '매입사', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '발급사', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '일시불', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '할부', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '서명', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '고객용', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '가맹점용', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '문의', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '고객센터', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '홈페이지', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '사업장주소', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '합계', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '합계금액', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '총합계', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '공급가액', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '부가세', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '부가가치세', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '과세', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '면세', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '승인금액', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '결제금액', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '받을금액', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '신용카드', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '현금영수증', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '포인트', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '적립', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '쿠폰', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '할인', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '거스름돈', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '잔돈', 'CONTAINS', NULL, 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '출발', 'CONTAINS', 'departure_place', 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '출발지', 'CONTAINS', 'departure_place', 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '승차', 'CONTAINS', 'departure_place', 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '승차역', 'CONTAINS', 'departure_place', 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '승차장', 'CONTAINS', 'departure_place', 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '출발역', 'CONTAINS', 'departure_place', 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '도착', 'CONTAINS', 'arrival_place', 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '도착지', 'CONTAINS', 'arrival_place', 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '하차', 'CONTAINS', 'arrival_place', 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '하차역', 'CONTAINS', 'arrival_place', 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '도착역', 'CONTAINS', 'arrival_place', 10),
('TRANSPORT_RECEIPT', 'SUMMARY', '운임', 'CONTAINS', 'total_amount', 20),
('TRANSPORT_RECEIPT', 'SUMMARY', '요금', 'CONTAINS', 'total_amount', 20),
('TRANSPORT_RECEIPT', 'SUMMARY', '승인금액', 'CONTAINS', 'total_amount', 20),
('TRANSPORT_RECEIPT', 'SUMMARY', '결제금액', 'CONTAINS', 'total_amount', 20),
('TRANSPORT_RECEIPT', 'SUMMARY', '합계', 'CONTAINS', 'total_amount', 20),
('TRANSPORT_RECEIPT', 'SUMMARY', '총액', 'CONTAINS', 'total_amount', 20),
('TRANSPORT_RECEIPT', 'EXCLUDE', '승인번호', 'CONTAINS', NULL, 10),
('TRANSPORT_RECEIPT', 'EXCLUDE', '카드번호', 'CONTAINS', NULL, 10),
('TRANSPORT_RECEIPT', 'EXCLUDE', '가맹점번호', 'CONTAINS', NULL, 10),
('TRANSPORT_RECEIPT', 'EXCLUDE', '사업자등록번호', 'CONTAINS', NULL, 10),
('TRANSPORT_RECEIPT', 'EXCLUDE', '고객용', 'CONTAINS', NULL, 10),
('TRANSPORT_RECEIPT', 'EXCLUDE', '카드승인정보', 'CONTAINS', NULL, 10);
INSERT INTO document_section_rules (document_type, section_type, keyword, match_type, target_field_key, priority, active_yn)
SELECT s.document_type, s.section_type, s.keyword, s.match_type, s.target_field_key, s.priority, 'Y'
FROM tmp_document_section_rule_seed s
WHERE NOT EXISTS (
  SELECT 1 FROM document_section_rules dsr
  WHERE dsr.document_type = s.document_type
    AND dsr.section_type = s.section_type
    AND dsr.keyword = s.keyword
);
DROP TEMPORARY TABLE IF EXISTS tmp_document_section_rule_seed;

-- ---------------------------------------------------------
-- 5. validation_rules 보강 및 기존 기준 강화
-- ---------------------------------------------------------
INSERT INTO validation_rules (rule_code, rule_name, rule_type, standard_field_id, condition_json, severity, is_active)
SELECT 'ITEM_EMPTY_CHECK', '상세 품목 0건 자동 정상처리 차단', 'ITEM_CHECK', (SELECT id FROM standard_fields WHERE field_key = 'item_name'), '{"min_item_count": 1, "block_pass": true}', 'ERROR', TRUE
WHERE NOT EXISTS (SELECT 1 FROM validation_rules WHERE rule_code = 'ITEM_EMPTY_CHECK');
INSERT INTO validation_rules (rule_code, rule_name, rule_type, standard_field_id, condition_json, severity, is_active)
SELECT 'ITEM_QTY_UNIT_AMOUNT_CHECK', '수량×단가=금액 검증', 'AMOUNT_CHECK', (SELECT id FROM standard_fields WHERE field_key = 'amount'), '{"quantity_field": "quantity", "unit_price_field": "unit_price", "amount_field": "amount", "tolerance": 0}', 'ERROR', TRUE
WHERE NOT EXISTS (SELECT 1 FROM validation_rules WHERE rule_code = 'ITEM_QTY_UNIT_AMOUNT_CHECK');
INSERT INTO validation_rules (rule_code, rule_name, rule_type, standard_field_id, condition_json, severity, is_active)
SELECT 'CATEGORY_UNKNOWN_REVIEW', '카테고리 기타/미분류 검토 유도', 'CATEGORY_CHECK', (SELECT id FROM standard_fields WHERE field_key = 'expense_category_name'), '{"review_values": ["기타", "ETC", "미분류", "UNKNOWN"], "block_auto_pass": false}', 'WARNING', TRUE
WHERE NOT EXISTS (SELECT 1 FROM validation_rules WHERE rule_code = 'CATEGORY_UNKNOWN_REVIEW');
INSERT INTO validation_rules (rule_code, rule_name, rule_type, standard_field_id, condition_json, severity, is_active)
SELECT 'OCR_QUALITY_REVIEW', 'OCR 품질 낮음 검토 유도', 'CONFIDENCE_CHECK', NULL, '{"min_ocr_quality": 0.55, "very_low_ocr_quality": 0.4, "need_supplement_if_very_low": true}', 'WARNING', TRUE
WHERE NOT EXISTS (SELECT 1 FROM validation_rules WHERE rule_code = 'OCR_QUALITY_REVIEW');
INSERT INTO validation_rules (rule_code, rule_name, rule_type, standard_field_id, condition_json, severity, is_active)
SELECT 'ITEM_NOISE_TEXT_CHECK', '품목명 OCR 노이즈 차단', 'ITEM_CHECK', (SELECT id FROM standard_fields WHERE field_key = 'item_name'), '{"max_non_korean_alnum_ratio": 0.45, "block_keywords": ["승인", "카드", "합계", "공급가액", "부가세", "가맹점", "사업자", "주소", "TEL"]}', 'ERROR', TRUE
WHERE NOT EXISTS (SELECT 1 FROM validation_rules WHERE rule_code = 'ITEM_NOISE_TEXT_CHECK');
UPDATE validation_rules
SET condition_json = JSON_OBJECT('item_amount_field', 'amount', 'total_field', 'total_amount', 'tolerance', 0),
    severity = 'ERROR',
    is_active = TRUE
WHERE rule_code = 'ITEM_SUM_TOTAL_CHECK';
UPDATE validation_rules
SET condition_json = JSON_OBJECT('quantity_field', 'quantity', 'unit_price_field', 'unit_price', 'amount_field', 'amount', 'tolerance', 0),
    severity = 'ERROR',
    is_active = TRUE
WHERE rule_code = 'ITEM_QTY_UNIT_AMOUNT_CHECK';
UPDATE validation_rules
SET condition_json = JSON_OBJECT('min_confidence', 0.80, 'min_ocr_quality', 0.55),
    severity = 'WARNING',
    is_active = TRUE
WHERE rule_code = 'LOW_CONFIDENCE';
UPDATE validation_rules
SET condition_json = JSON_OBJECT('exclude_keywords', JSON_ARRAY('합계','총액','부가세','공급가액','승인금액','결제금액','카드번호','승인번호','현금영수증','포인트','거스름돈','가맹점','사업자','대표자','주소','TEL','전화','고객수','주문자','일시불','할부','매입사','발급사')),
    severity = 'ERROR',
    is_active = TRUE
WHERE rule_code = 'ITEM_NON_ITEM_KEYWORD_CHECK';

-- ---------------------------------------------------------
-- 6. 적용 확인
-- ---------------------------------------------------------
SELECT 'CATEGORY_RULES_APPROVED_ACTIVE' AS name, COUNT(*) AS cnt FROM correction_dictionaries WHERE dictionary_type = 'CATEGORY' AND status='APPROVED' AND active_yn='Y'
UNION ALL
SELECT 'CORRECTION_RULES_APPROVED_ACTIVE', COUNT(*) FROM correction_dictionaries WHERE dictionary_type IN ('OCR_TEXT','ITEM','VENDOR','PAYMENT') AND status='APPROVED' AND active_yn='Y'
UNION ALL
SELECT 'DOCUMENT_TYPE_RULES_ACTIVE', COUNT(*) FROM document_type_rules WHERE active_yn='Y'
UNION ALL
SELECT 'DOCUMENT_SECTION_RULES_ACTIVE', COUNT(*) FROM document_section_rules WHERE active_yn='Y'
UNION ALL
SELECT 'VALIDATION_RULES_ACTIVE', COUNT(*) FROM validation_rules WHERE is_active=TRUE;

-- =========================================================
-- FINAL CHECK: FULL INIT + DB RULE CONTEXT EXTENDED SEED
-- =========================================================
SET FOREIGN_KEY_CHECKS = 1;

SELECT 'FULL_INIT_WITH_DB_RULE_CONTEXT_COMPLETED' AS message, DATABASE() AS database_name;

SELECT 'roles' AS tbl, COUNT(*) AS cnt FROM roles
UNION ALL SELECT 'departments', COUNT(*) FROM departments
UNION ALL SELECT 'sites', COUNT(*) FROM sites
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'expense_categories', COUNT(*) FROM expense_categories
UNION ALL SELECT 'standard_fields', COUNT(*) FROM standard_fields
UNION ALL SELECT 'field_aliases', COUNT(*) FROM field_aliases
UNION ALL SELECT 'document_type_fields', COUNT(*) FROM document_type_fields
UNION ALL SELECT 'document_type_rules', COUNT(*) FROM document_type_rules
UNION ALL SELECT 'document_section_rules', COUNT(*) FROM document_section_rules
UNION ALL SELECT 'validation_rules', COUNT(*) FROM validation_rules
UNION ALL SELECT 'correction_dictionaries', COUNT(*) FROM correction_dictionaries;

SELECT dictionary_type, COUNT(*) AS cnt
FROM correction_dictionaries
WHERE status='APPROVED' AND active_yn='Y'
GROUP BY dictionary_type
ORDER BY dictionary_type;

SELECT corrected_text AS category_code, COUNT(*) AS keyword_count
FROM correction_dictionaries
WHERE dictionary_type='CATEGORY'
  AND status='APPROVED'
  AND active_yn='Y'
GROUP BY corrected_text
ORDER BY corrected_text;

-- =========================================================
-- DB Rule Context Extended Seed V2 / Patch
-- 생성일: 2026-06-16
-- 목적:
--   1) 확장 Seed 1차 이후 부족했던 OCR_TEXT / ITEM / VENDOR / EXCLUDE / CATEGORY 데이터 대폭 보강
--   2) 특정 영수증 금액/품목을 고정하지 않고, 공통 규칙/보정/검증 기준만 추가
--   3) 중복 실행해도 안전하도록 NOT EXISTS + DISTINCT 기준 삽입
-- =========================================================

-- ---------------------------------------------------------
-- 0. 경비 카테고리 기준 보강
-- ---------------------------------------------------------
INSERT INTO expense_categories (category_code, category_name, description, is_active) SELECT 'MEAL', '식비', '식사, 회식, 카페, 베이커리 등 식음료 관련 비용', TRUE WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE category_code = 'MEAL');
INSERT INTO expense_categories (category_code, category_name, description, is_active) SELECT 'TRANSPORT', '교통비', 'KTX, SRT, 버스, 택시, 주차, 통행료 등 이동 관련 비용', TRUE WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE category_code = 'TRANSPORT');
INSERT INTO expense_categories (category_code, category_name, description, is_active) SELECT 'LODGING', '숙박비', '호텔, 모텔, 리조트, 펜션 등 숙박 관련 비용', TRUE WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE category_code = 'LODGING');
INSERT INTO expense_categories (category_code, category_name, description, is_active) SELECT 'SUPPLIES', '소모품비', '현장/사무 소모품 구매 비용', TRUE WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE category_code = 'SUPPLIES');
INSERT INTO expense_categories (category_code, category_name, description, is_active) SELECT 'FUEL', '유류비', '휘발유, 경유, LPG, 전기차 충전 등 차량 연료 비용', TRUE WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE category_code = 'FUEL');
INSERT INTO expense_categories (category_code, category_name, description, is_active) SELECT 'COMMUNICATION', '통신비', '휴대폰, 인터넷, 통신 요금 관련 비용', TRUE WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE category_code = 'COMMUNICATION');
INSERT INTO expense_categories (category_code, category_name, description, is_active) SELECT 'MATERIAL', '자재비', '공사/현장 자재 및 공구 구매 비용', TRUE WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE category_code = 'MATERIAL');
INSERT INTO expense_categories (category_code, category_name, description, is_active) SELECT 'ETC', '기타', '분류가 어려운 기타 비용', TRUE WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE category_code = 'ETC');

-- ---------------------------------------------------------
-- 1. CATEGORY 키워드 보강: 652건
-- ---------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_rule_category_seed_v2;
CREATE TEMPORARY TABLE tmp_rule_category_seed_v2 (dictionary_type VARCHAR(50), wrong_text VARCHAR(255), corrected_text VARCHAR(255), match_type VARCHAR(30), min_similarity DECIMAL(5,4) NULL, document_type VARCHAR(50), priority INT, description TEXT) ENGINE=InnoDB;
INSERT INTO tmp_rule_category_seed_v2 (dictionary_type, wrong_text, corrected_text, match_type, min_similarity, document_type, priority, description) VALUES
('CATEGORY', '음식점', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '식당', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '한식', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '중식', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '일식', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '양식', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '분식', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '뷔페', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '레스토랑', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '푸드코트', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '구내식당', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '식권', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '식대', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '식사', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '점심', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '저녁', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '조식', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '중식대', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '석식', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '회식', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '도시락', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '김밥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '라면', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '우동', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '라멘', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '냉면', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '국수', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '칼국수', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '쌀국수', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '짜장', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '짜장면', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '짬뽕', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '탕수육', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '마라탕', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '마라샹궈', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '국밥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '순대국', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '순댓국', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '설렁탕', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '곰탕', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '해장국', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '백반', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '찌개', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '김치찌개', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '된장찌개', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '순두부찌개', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '부대찌개', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '전골', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '감자탕', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '해물탕', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '삼계탕', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '비빔밥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '덮밥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '볶음밥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '마늘밥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '공기밥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '돈까스', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '돈가스', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '제육', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '불고기', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '보쌈', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '족발', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '치킨', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '닭갈비', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '닭강정', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '삼겹살', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '목살', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '갈비', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '양갈비', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '프렌치랙', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '소고기', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '돼지고기', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '양고기', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '고기집', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '고깃집', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '정육식당', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '구이', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '곱창', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '막창', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '대창', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '초밥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '스시', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '사시미', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '참치', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '해산물', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '조개구이', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '생선구이', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '장어', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '아구찜', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '찜닭', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '피자', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '파스타', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '스테이크', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '햄버거', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '버거', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '샌드위치', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '샐러드', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '감바스', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '리조또', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '또띠아', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '브리또', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '타코', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '케밥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '포케', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '죽', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '만두', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '떡볶이', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '순대', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '튀김', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '어묵', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '오뎅', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '호떡', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '토스트', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '핫도그', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '닭발', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '육회', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '샤브샤브', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '월남쌈', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '쌈밥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '낙지', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '오징어', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '물회', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '회덮밥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '메밀', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '소바', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '규동', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '가츠동', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '텐동', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '카레', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '오므라이스', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '스파게티', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '빵', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '베이커리', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '바게트', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '바게뜨', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '파리바게뜨', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '파리바게트', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '뚜레쥬르', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '던킨', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '크리스피도넛', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '도넛', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '케이크', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '쿠키', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '크로와상', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '크루아상', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '소금빵', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '식빵', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '샐러드빵', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '카페', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '커피', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '아메리카노', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '라떼', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '카페라떼', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '바닐라라떼', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '카푸치노', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '에스프레소', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '콜드브루', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '디카페인', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '아인슈페너', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '모카', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '초코라떼', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '녹차라떼', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '밀크티', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '스무디', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '에이드', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '주스', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '쥬스', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '아이스티', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '프라푸치노', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '빙수', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '아이스크림', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '젤라또', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '요거트', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '티라미수', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '마카롱', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '디저트', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 10, '식비 강한 키워드'),
('CATEGORY', '소주', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '맥주', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '생맥주', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '병맥주', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '하이볼', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '참이슬', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '처음처럼', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '진로', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '카스', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '테라', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '클라우드', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '한맥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '켈리', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '막걸리', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '청하', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '매화수', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '와인', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '사케', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '코젤', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '호가든', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '기네스', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '칭따오', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '아사히', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '산토리', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '토닉워터', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 25, '음식점 영수증 내 주류는 식비 유지, 필요 시 비고/검토 처리'),
('CATEGORY', '맥도날드', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '롯데리아', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '버거킹', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '맘스터치', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', 'KFC', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '서브웨이', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '스타벅스', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '투썸플레이스', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '이디야', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '메가커피', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '컴포즈커피', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '빽다방', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '매머드커피', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '매머드익스프레스', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '할리스', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '커피빈', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '엔제리너스', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '공차', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '설빙', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '본죽', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '한솥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '본도시락', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '홍콩반점', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '역전우동', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '미소야', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '김가네', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '고봉민김밥', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '명륜진사갈비', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '육전식당', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '새마을식당', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '백종원', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '원할머니보쌈', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '놀부부대찌개', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '교촌치킨', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', 'BBQ', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', 'BHC', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '굽네치킨', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '처갓집치킨', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '네네치킨', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '도미노피자', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '피자헛', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '미스터피자', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '이삭토스트', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '파리크라상', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '배스킨라빈스', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', '던킨도너츠', 'MEAL', 'CONTAINS', NULL, 'RECEIPT', 12, '식비 프랜차이즈/상호 키워드'),
('CATEGORY', 'KTX', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', 'SRT', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', 'ITX', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '새마을', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '무궁화', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '누리로', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '코레일', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '철도', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '열차', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '승차권', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '승차표', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '승차일', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '승차일시', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '승차', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '운임', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '요금', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '역명', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '출발', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '도착', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '좌석', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '호차', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '열차번호', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '고속버스', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '시외버스', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '버스', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '터미널', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '버스터미널', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '고속터미널', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '시외터미널', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '승차홈', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '탑승권', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '탑승', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '승차권번호', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '승차권영수증', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '택시', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '카카오T', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '카카오택시', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '티머니', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '캐시비', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '교통카드', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '지하철', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '전철', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '도시철도', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '공항철도', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '리무진버스', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '공항버스', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '주차', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '주차장', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '주차요금', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '주차비', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '주차권', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '주차정산', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '출차', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '입차', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '하이패스', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '통행료', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '톨게이트', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '고속도로', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '도로공사', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '통행권', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '대리운전', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '렌터카', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '렌트카', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '카셰어링', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '쏘카', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '그린카', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '킥보드', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '항공권', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '항공', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '운항', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '대한항공', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '아시아나', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '진에어', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '제주항공', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '티웨이', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '에어서울', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '에어부산', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '공항', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '셔틀버스', 'TRANSPORT', 'CONTAINS', NULL, 'RECEIPT', 10, '교통비 키워드'),
('CATEGORY', '다이소', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '아성다이소', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '국민가게다이소', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '문구', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '문구점', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '사무용품', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '사무실용품', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '오피스용품', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '오피스디포', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '오피스넥스', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '모닝글로리', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '알파문구', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '드림디포', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', 'A4', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '복사용지', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '용지', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '종이', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '노트', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '수첩', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '포스트잇', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '메모지', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '파일', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '클리어파일', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '바인더', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '집게', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '클립', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '스테이플러', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '호치키스', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '심', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '샤프', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '볼펜', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '펜', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '연필', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '지우개', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '형광펜', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '네임펜', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '매직', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '마카', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '칼', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '커터칼', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '가위', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '자', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '테이프', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '박스테이프', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '양면테이프', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '절연테이프', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '마스킹테이프', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '청테이프', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '포장테이프', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '풀', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '본드', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '접착제', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '봉투', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '쇼핑백', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '비닐봉투', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '박스', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '택배박스', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '완충재', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '뽁뽁이', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '라벨', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '라벨지', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '토너', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '잉크', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '카트리지', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '프린터용지', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '건전지', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '배터리', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '충전기', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '케이블', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', 'C타입', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', 'USB', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', 'HDMI', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '멀티탭', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '콘센트', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '어댑터', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '마우스', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '키보드', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '마우스패드', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '랜선', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '공유기', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '이어폰', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '헤드셋', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '장갑', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '코팅장갑', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '면장갑', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '안전장갑', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '마스크', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '방진마스크', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '보안경', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '귀마개', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '토시', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '앞치마', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '우비', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '비옷', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '핫팩', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '아이스팩', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '물티슈', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '티슈', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '휴지', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '키친타올', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '종이컵', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '컵', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '일회용컵', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '빨대', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '접시', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '젓가락', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '숟가락', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '세제', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '락스', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '소독제', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '알콜스왑', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '손소독제', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '핸드워시', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '비누', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '샴푸', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '청소용품', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '빗자루', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '쓰레받기', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '걸레', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '밀대', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '청소포', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '쓰레기봉투', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '분리수거봉투', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '수세미', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '행주', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '방향제', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '탈취제', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '파스', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '밴드', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '구급함', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '구급약', 'SUPPLIES', 'CONTAINS', NULL, 'RECEIPT', 10, '소모품비 키워드'),
('CATEGORY', '주유', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '주유소', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '휘발유', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '경유', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '등유', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', 'LPG', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '가스충전', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '충전소', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '전기차충전', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', 'EV충전', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '고급휘발유', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '보통휘발유', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '요소수', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '엔진오일', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '워셔액', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '세차', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '세차장', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '자동세차', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '셀프세차', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', 'GS칼텍스', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', 'SK에너지', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', 'SK주유소', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', 'S-OIL', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', 'SOIL', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '에쓰오일', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '현대오일뱅크', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', 'HD현대오일뱅크', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '알뜰주유소', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '농협주유소', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '오일뱅크', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '가득주유', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '리터', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '유종', 'FUEL', 'CONTAINS', NULL, 'RECEIPT', 10, '유류비 키워드'),
('CATEGORY', '호텔', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '모텔', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '숙박', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '숙소', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '리조트', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '펜션', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '게스트하우스', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '여관', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '여인숙', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '콘도', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '레지던스', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '호스텔', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '객실', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '객실료', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '숙박료', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '숙박비', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '체크인', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '체크아웃', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '프론트', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '예약번호', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '야놀자', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '여기어때', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '아고다', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '부킹닷컴', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '호텔스닷컴', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '에어비앤비', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', 'Airbnb', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '라마다', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '신라스테이', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '토요코인', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '롯데호텔', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '베스트웨스턴', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '그랜드호텔', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '비즈니스호텔', 'LODGING', 'CONTAINS', NULL, 'RECEIPT', 10, '숙박비 키워드'),
('CATEGORY', '통신요금', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', '휴대폰요금', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', '휴대전화요금', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', '전화요금', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', '인터넷요금', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', '인터넷', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', '통신비', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', 'SKT', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', 'KT', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', 'LGU+', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', 'LG유플러스', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', '유플러스', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', '에스케이텔레콤', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', '케이티', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', '알뜰폰', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', '로밍', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', '데이터요금', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', '와이파이', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', 'WIFI', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', '유심', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', 'USIM', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', '모뎀', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', '임대료', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', '통신', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', '통화료', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', '문자요금', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', '인터넷전화', 'COMMUNICATION', 'CONTAINS', NULL, 'RECEIPT', 10, '통신비 키워드'),
('CATEGORY', '자재', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '건자재', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '철물', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '철물점', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '공구', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '공구상가', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '전선', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '전기자재', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '배관', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '파이프', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', 'PVC', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '엑셀관', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', 'CD관', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '후렉시블', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '덕트', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '볼트', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '너트', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '와셔', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '피스', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '나사', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '앙카', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '앵커', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '실리콘', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '우레탄', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '폼본드', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '시멘트', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '몰탈', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '레미탈', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '모래', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '자갈', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '벽돌', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '블럭', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '블록', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '합판', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '목재', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '각재', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '석고보드', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '타일', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '페인트', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '락카', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '니스', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '바니쉬', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '방수재', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '단열재', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '보온재', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '안전모', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '안전화', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '안전벨트', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '안전조끼', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '안전용품', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '작업복', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '형광조끼', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '라바콘', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '콘', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '휀스', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '안전펜스', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '표지판', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '전기테이프', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '전동드릴', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '드릴비트', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '그라인더', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '절단석', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '사포', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '톱날', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '용접봉', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '용접장갑', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '배관자재', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '밸브', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '엘보', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '소켓', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '니플', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '플랜지', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '철근', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '철판', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', 'H빔', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '강관', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '스텐', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '알루미늄', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '자재비', 'MATERIAL', 'CONTAINS', NULL, 'RECEIPT', 10, '자재비 키워드'),
('CATEGORY', '유흥', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드'),
('CATEGORY', '주점', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드'),
('CATEGORY', '룸살롱', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드'),
('CATEGORY', 'BAR', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드'),
('CATEGORY', '바', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드'),
('CATEGORY', '호프', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드'),
('CATEGORY', '포차', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드'),
('CATEGORY', '노래방', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드'),
('CATEGORY', '단란주점', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드'),
('CATEGORY', '클럽', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드'),
('CATEGORY', '라운지', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드'),
('CATEGORY', '접대', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드'),
('CATEGORY', '선물', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드'),
('CATEGORY', '기프트', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드'),
('CATEGORY', '상품권', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드'),
('CATEGORY', '기프티콘', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드'),
('CATEGORY', '복권', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드'),
('CATEGORY', '담배', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드'),
('CATEGORY', '전자담배', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드'),
('CATEGORY', '카지노', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드'),
('CATEGORY', '게임장', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드'),
('CATEGORY', '오락실', 'ETC', 'CONTAINS', NULL, 'RECEIPT', 30, '기타/검토 유도 키워드');
INSERT INTO correction_dictionaries (dictionary_type, wrong_text, corrected_text, match_type, min_similarity, document_type, priority, status, active_yn, suggested_by, description, created_by, approved_by, approved_at)
SELECT DISTINCT t.dictionary_type, t.wrong_text, t.corrected_text, t.match_type, t.min_similarity, t.document_type, t.priority, 'APPROVED', 'Y', 'SYSTEM', t.description, NULL, NULL, CURRENT_TIMESTAMP
FROM tmp_rule_category_seed_v2 t
WHERE NOT EXISTS (SELECT 1 FROM correction_dictionaries cd WHERE cd.dictionary_type=t.dictionary_type AND cd.wrong_text=t.wrong_text AND IFNULL(cd.document_type,'COMMON')=IFNULL(t.document_type,'COMMON'));
DROP TEMPORARY TABLE IF EXISTS tmp_rule_category_seed_v2;

-- ---------------------------------------------------------
-- 2. OCR_TEXT / ITEM / VENDOR / PAYMENT 보정 보강: 202건
-- ---------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_rule_correction_seed_v2;
CREATE TEMPORARY TABLE tmp_rule_correction_seed_v2 (dictionary_type VARCHAR(50), wrong_text VARCHAR(255), corrected_text VARCHAR(255), match_type VARCHAR(30), min_similarity DECIMAL(5,4) NULL, document_type VARCHAR(50), priority INT, description TEXT) ENGINE=InnoDB;
INSERT INTO tmp_rule_correction_seed_v2 (dictionary_type, wrong_text, corrected_text, match_type, min_similarity, document_type, priority, description) VALUES
('OCR_TEXT', '영수중', '영수증', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '영수증]', '영수증', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '영수증)134', '영수증', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '가계산', '중간계산', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '중간계산 ]', '중간계산서', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '숲간계산서', '중간계산서', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '상 품 명', '상품명', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '싱품명', '상품명', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '상풍명', '상품명', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '상픔명', '상품명', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '품 명', '품명', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '품목 명', '품목명', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '상품 명', '상품명', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '단 가', '단가', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '수 량', '수량', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '수량 교', '수량', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '수량 힐인', '수량 할인', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '힐인', '할인', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '활인', '할인', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '한인', '할인', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '할 인', '할인', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '금 액', '금액', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '그액', '금액', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '그액금의', '금액', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '금의', '금액', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', 'HO높므', '금액', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '합 계', '합계', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '합게', '합계', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '일 계', '일계', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '총 계', '총계', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '공급 가액', '공급가액', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '공급가', '공급가액', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '공급대가', '공급가액', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '부 가 세', '부가세', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '부가 세', '부가세', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '부가가치 세', '부가가치세', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '가 세', '부가세', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '결 제', '결제', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '결재', '결제', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '신용카드', '카드', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '체크카드', '카드', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '신용승인정보', '신용 승인 정보', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '승 인', '승인', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '승인 번호', '승인번호', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '승인일 시', '승인일시', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '매 출 일', '매출일', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '매출 일', '매출일', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '거 래 일', '거래일', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '거래 일시', '거래일시', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '주문 자', '주문자', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '고객 수', '고객수', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '사업 자', '사업자', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '사업자 등록번호', '사업자등록번호', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '가맹점 번호', '가맹점번호', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '대표 자', '대표자', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '전화 번호', '전화번호', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '라무진', '리무진', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '리무진나주혁신점', '리무진 나주혁신점', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '월간나주혁신도시점', '월간 나주혁신도시점', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '원간', '월간', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '원간나주혁신도시점', '월간 나주혁신도시점', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '하이몰', '하이볼', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '하이롤', '하이볼', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '하이불', '하이볼', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '모히또 하이', '모히또 하이볼', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '자몽 하이', '자몽 하이볼', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '피치 얼그레', '피치 얼그레이', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '얼그레', '얼그레이', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '패퍼로니', '페퍼로니', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '페퍼로니피자', '페퍼로니 피자', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '크림치즈 꽃감말이', '크림치즈 곶감말이', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '꽃감말이', '곶감말이', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '감말이', '곶감말이', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '프넨치랙', '프렌치랙', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '프렌치랙1개', '프렌치랙 1개', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '징기스킨', '징기스칸', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '징기스킨양길미', '징기스칸 양갈비', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '양길미', '양갈비', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '양길비', '양갈비', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '마늘발', '마늘밥', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '마늘밤', '마늘밥', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '매머드익스프레스', '매머드 익스프레스', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '메머드익스프레스', '매머드 익스프레스', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '맥먹드익스프레스', '매머드 익스프레스', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '맥머드익스프레스', '매머드 익스프레스', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '파리바게트', '파리바게뜨', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', 'PARISBAGUETTE', '파리바게뜨', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '뚜레쥬르', '뚜레쥬르', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '다이소', '다이소', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '아성다이소', '다이소', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '국민가게다이소', '다이소', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '코레일네트웍스', '코레일', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', 'KORAIL', '코레일', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '카카오 티', '카카오T', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '카카오티', '카카오T', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', 'TMAP', '티맵', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '티맵주차', '티맵 주차', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '000`', '000', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '000''', '000', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '92,''200', '92,200', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', '0000', '0', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', 'o 6,000', '0 6,000', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', 'O 6,000', '0 6,000', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', 'o 12,000', '0 12,000', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('OCR_TEXT', 'O 12,000', '0 12,000', 'CONTAINS', NULL, 'COMMON', 10, 'OCR 공통 오인식/띄어쓰기 보정'),
('ITEM', '하이몰', '하이볼', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '하이롤', '하이볼', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '하이불', '하이볼', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '자몽 하이몰', '자몽 하이볼', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '모히또 하이', '모히또 하이볼', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '피치 얼그레', '피치 얼그레이', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '패퍼로니 피자', '페퍼로니 피자', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '패퍼로니', '페퍼로니', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '크림치즈 꽃감말이', '크림치즈 곶감말이', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '꽃감말이', '곶감말이', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '감말이', '곶감말이', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '징기스킨', '징기스칸', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '징기스킨양길미', '징기스칸 양갈비', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '징기스칸양길미', '징기스칸 양갈비', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '양길미', '양갈비', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '양길비', '양갈비', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '프넨치랙', '프렌치랙', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '프넨치락', '프렌치랙', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '프렌치랙1개', '프렌치랙', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '마늘발', '마늘밥', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '마늘밤', '마늘밥', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '두부김지', '두부김치', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '두부김치전', '두부김치', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '소주1개', '소주', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '맥주2개', '맥주', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '아메리카노ICE', '아이스 아메리카노', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '아이스아메리카노', '아이스 아메리카노', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '카페라데', '카페라떼', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '바닐라라데', '바닐라라떼', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '봉투값', '봉투', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '쇼핑백값', '쇼핑백', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '종량제봉투', '종량제 봉투', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '건전지AA', 'AA 건전지', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('ITEM', '물티슈캡형', '물티슈', 'CONTAINS', NULL, 'RECEIPT', 10, '품목명 OCR/표기 보정'),
('VENDOR', '라무진나주혁신점', '리무진 나주혁신점', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '라무진 나주혁신점', '리무진 나주혁신점', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '리무진나주혁신점', '리무진 나주혁신점', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '월간나주혁신도시점', '월간 나주혁신도시점', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '원간나주혁신도시점', '월간 나주혁신도시점', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '송림전집', '송림전집', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '승림전집', '송림전집', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '매머드익스프레스', '매머드 익스프레스', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '메머드익스프레스', '매머드 익스프레스', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '맥먹드익스프레스', '매머드 익스프레스', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '맥머드익스프레스', '매머드 익스프레스', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', 'MAMMOTH', '매머드 익스프레스', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '파리바게트', '파리바게뜨', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '파리바게뜨', '파리바게뜨', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', 'PARISBAGUETTE', '파리바게뜨', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '광주서석파리바게뜨', '파리바게뜨', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '뚜레쥬르', '뚜레쥬르', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '아성다이소', '다이소', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '국민가게다이소', '다이소', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', 'DAISO', '다이소', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '다이소몰', '다이소', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '코레일네트웍스', '코레일', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', 'KORAIL', '코레일', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '한국철도공사', '코레일', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '카카오모빌리티', '카카오T', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '카카오 티', '카카오T', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '카카오티', '카카오T', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', 'GS칼텍스', 'GS칼텍스', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '지에스칼텍스', 'GS칼텍스', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', 'SK에너지', 'SK에너지', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '에스케이에너지', 'SK에너지', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', 'S-OIL', 'S-OIL', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '에쓰오일', 'S-OIL', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '현대오일뱅크', 'HD현대오일뱅크', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '씨유', 'CU', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', 'CU편의점', 'CU', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', 'GS25', 'GS25', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '지에스25', 'GS25', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '세븐일레븐', '세븐일레븐', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '이마트24', '이마트24', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '스타벅스커피코리아', '스타벅스', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '스타벅스', '스타벅스', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '투썸플레이스', '투썸플레이스', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '이디야커피', '이디야', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '메가엠지씨커피', '메가커피', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '컴포즈커피', '컴포즈커피', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('VENDOR', '빽다방', '빽다방', 'CONTAINS', NULL, 'RECEIPT', 10, '상호명 OCR/표기 보정'),
('PAYMENT', '신용카드', '카드', 'CONTAINS', NULL, 'COMMON', 10, '결제수단 표준화'),
('PAYMENT', '체크카드', '카드', 'CONTAINS', NULL, 'COMMON', 10, '결제수단 표준화'),
('PAYMENT', '체크', '카드', 'CONTAINS', NULL, 'COMMON', 10, '결제수단 표준화'),
('PAYMENT', '카드승인', '카드', 'CONTAINS', NULL, 'COMMON', 10, '결제수단 표준화'),
('PAYMENT', '신용승인', '카드', 'CONTAINS', NULL, 'COMMON', 10, '결제수단 표준화'),
('PAYMENT', '일시물', '일시불', 'CONTAINS', NULL, 'COMMON', 10, '결제수단 표준화'),
('PAYMENT', '일시불', '일시불', 'CONTAINS', NULL, 'COMMON', 10, '결제수단 표준화'),
('PAYMENT', '현 금', '현금', 'CONTAINS', NULL, 'COMMON', 10, '결제수단 표준화'),
('PAYMENT', '현금영수증', '현금', 'CONTAINS', NULL, 'COMMON', 10, '결제수단 표준화'),
('PAYMENT', '간편 결제', '간편결제', 'CONTAINS', NULL, 'COMMON', 10, '결제수단 표준화'),
('PAYMENT', '간편결재', '간편결제', 'CONTAINS', NULL, 'COMMON', 10, '결제수단 표준화'),
('PAYMENT', '카카오페이', '간편결제', 'CONTAINS', NULL, 'COMMON', 10, '결제수단 표준화'),
('PAYMENT', '네이버페이', '간편결제', 'CONTAINS', NULL, 'COMMON', 10, '결제수단 표준화'),
('PAYMENT', '삼성페이', '간편결제', 'CONTAINS', NULL, 'COMMON', 10, '결제수단 표준화'),
('PAYMENT', '제로페이', '간편결제', 'CONTAINS', NULL, 'COMMON', 10, '결제수단 표준화'),
('PAYMENT', '계좌 이체', '계좌이체', 'CONTAINS', NULL, 'COMMON', 10, '결제수단 표준화');
INSERT INTO correction_dictionaries (dictionary_type, wrong_text, corrected_text, match_type, min_similarity, document_type, priority, status, active_yn, suggested_by, description, created_by, approved_by, approved_at)
SELECT DISTINCT t.dictionary_type, t.wrong_text, t.corrected_text, t.match_type, t.min_similarity, t.document_type, t.priority, 'APPROVED', 'Y', 'SYSTEM', t.description, NULL, NULL, CURRENT_TIMESTAMP
FROM tmp_rule_correction_seed_v2 t
WHERE NOT EXISTS (SELECT 1 FROM correction_dictionaries cd WHERE cd.dictionary_type=t.dictionary_type AND cd.wrong_text=t.wrong_text AND IFNULL(cd.document_type,'COMMON')=IFNULL(t.document_type,'COMMON'));
DROP TEMPORARY TABLE IF EXISTS tmp_rule_correction_seed_v2;

-- ---------------------------------------------------------
-- 3. 문서유형 판별 규칙 보강: 120건
-- ---------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_document_type_rules_seed_v2;
CREATE TEMPORARY TABLE tmp_document_type_rules_seed_v2 (document_type VARCHAR(50), keyword VARCHAR(100), match_type VARCHAR(30), score INT) ENGINE=InnoDB;
INSERT INTO tmp_document_type_rules_seed_v2 (document_type, keyword, match_type, score) VALUES
('ITEM_RECEIPT', '영수증', 'CONTAINS', 15),
('ITEM_RECEIPT', '계산서', 'CONTAINS', 15),
('ITEM_RECEIPT', '간이영수증', 'CONTAINS', 15),
('ITEM_RECEIPT', '중간계산서', 'CONTAINS', 15),
('ITEM_RECEIPT', '상품명', 'CONTAINS', 15),
('ITEM_RECEIPT', '품명', 'CONTAINS', 15),
('ITEM_RECEIPT', '품목명', 'CONTAINS', 15),
('ITEM_RECEIPT', '단가', 'CONTAINS', 15),
('ITEM_RECEIPT', '수량', 'CONTAINS', 15),
('ITEM_RECEIPT', '할인', 'CONTAINS', 15),
('ITEM_RECEIPT', '금액', 'CONTAINS', 15),
('ITEM_RECEIPT', '합계', 'CONTAINS', 15),
('ITEM_RECEIPT', '총계', 'CONTAINS', 15),
('ITEM_RECEIPT', '일계', 'CONTAINS', 15),
('ITEM_RECEIPT', '판매합계', 'CONTAINS', 15),
('ITEM_RECEIPT', '과세합계', 'CONTAINS', 15),
('ITEM_RECEIPT', '부가세', 'CONTAINS', 15),
('ITEM_RECEIPT', '공급가액', 'CONTAINS', 15),
('ITEM_RECEIPT', '테이블', 'CONTAINS', 15),
('ITEM_RECEIPT', '주문자', 'CONTAINS', 15),
('ITEM_RECEIPT', '고객수', 'CONTAINS', 15),
('ITEM_RECEIPT', '메뉴', 'CONTAINS', 15),
('ITEM_RECEIPT', '메뉴명', 'CONTAINS', 15),
('ITEM_RECEIPT', '매출일', 'CONTAINS', 15),
('ITEM_RECEIPT', '영수금액', 'CONTAINS', 15),
('ITEM_RECEIPT', '결제금액', 'CONTAINS', 15),
('ITEM_RECEIPT', '받은금액', 'CONTAINS', 15),
('ITEM_RECEIPT', '신용카드', 'CONTAINS', 15),
('ITEM_RECEIPT', '현금영수증', 'CONTAINS', 15),
('TRANSPORT_RECEIPT', 'KTX', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', 'SRT', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', 'ITX', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '코레일', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '철도', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '열차', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '승차권', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '승차표', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '운임', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '출발', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '도착', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '좌석', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '호차', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '열차번호', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '승차일', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '승차일시', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '버스', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '터미널', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '고속버스', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '시외버스', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '택시', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '카카오T', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '주차', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '하이패스', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '통행료', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '톨게이트', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '항공권', 'CONTAINS', 25),
('TRANSPORT_RECEIPT', '탑승권', 'CONTAINS', 25),
('CARD_RECEIPT', '승인번호', 'CONTAINS', 20),
('CARD_RECEIPT', '승인금액', 'CONTAINS', 20),
('CARD_RECEIPT', '승인일시', 'CONTAINS', 20),
('CARD_RECEIPT', '카드번호', 'CONTAINS', 20),
('CARD_RECEIPT', '카드회원번호', 'CONTAINS', 20),
('CARD_RECEIPT', '가맹점번호', 'CONTAINS', 20),
('CARD_RECEIPT', '신용승인', 'CONTAINS', 20),
('CARD_RECEIPT', '신용카드', 'CONTAINS', 20),
('CARD_RECEIPT', '체크카드', 'CONTAINS', 20),
('CARD_RECEIPT', '일시불', 'CONTAINS', 20),
('CARD_RECEIPT', '매입사', 'CONTAINS', 20),
('CARD_RECEIPT', '발급사', 'CONTAINS', 20),
('CARD_RECEIPT', '할부개월', 'CONTAINS', 20),
('DELIVERY_NOTE', '납품서', 'CONTAINS', 20),
('DELIVERY_NOTE', '납품일자', 'CONTAINS', 20),
('DELIVERY_NOTE', '납품번호', 'CONTAINS', 20),
('DELIVERY_NOTE', '납품장소', 'CONTAINS', 20),
('DELIVERY_NOTE', '인수자', 'CONTAINS', 20),
('DELIVERY_NOTE', '거래명세', 'CONTAINS', 20),
('DELIVERY_NOTE', '납품', 'CONTAINS', 20),
('DELIVERY_NOTE', '품명', 'CONTAINS', 20),
('DELIVERY_NOTE', '규격', 'CONTAINS', 20),
('DELIVERY_NOTE', '단위', 'CONTAINS', 20),
('DELIVERY_NOTE', '수량', 'CONTAINS', 20),
('DELIVERY_NOTE', '발주번호', 'CONTAINS', 20),
('DELIVERY_NOTE', '구매발주', 'CONTAINS', 20),
('TRANSACTION_STATEMENT', '거래명세서', 'CONTAINS', 20),
('TRANSACTION_STATEMENT', '거래일자', 'CONTAINS', 20),
('TRANSACTION_STATEMENT', '거래처', 'CONTAINS', 20),
('TRANSACTION_STATEMENT', '공급가액', 'CONTAINS', 20),
('TRANSACTION_STATEMENT', '세액', 'CONTAINS', 20),
('TRANSACTION_STATEMENT', '합계금액', 'CONTAINS', 20),
('TRANSACTION_STATEMENT', '품명', 'CONTAINS', 20),
('TRANSACTION_STATEMENT', '규격', 'CONTAINS', 20),
('TRANSACTION_STATEMENT', '수량', 'CONTAINS', 20),
('TRANSACTION_STATEMENT', '단가', 'CONTAINS', 20),
('TRANSACTION_STATEMENT', '금액', 'CONTAINS', 20),
('TRANSACTION_STATEMENT', '청구금액', 'CONTAINS', 20),
('TRANSACTION_STATEMENT', '미수금', 'CONTAINS', 20),
('TRANSACTION_STATEMENT', '입금액', 'CONTAINS', 20),
('MATERIAL_INSPECTION', '자재검수', 'CONTAINS', 20),
('MATERIAL_INSPECTION', '검수증', 'CONTAINS', 20),
('MATERIAL_INSPECTION', '검수일자', 'CONTAINS', 20),
('MATERIAL_INSPECTION', '검수결과', 'CONTAINS', 20),
('MATERIAL_INSPECTION', '합격', 'CONTAINS', 20),
('MATERIAL_INSPECTION', '불합격', 'CONTAINS', 20),
('MATERIAL_INSPECTION', '입고창고', 'CONTAINS', 20),
('MATERIAL_INSPECTION', '자재명', 'CONTAINS', 20),
('MATERIAL_INSPECTION', '규격', 'CONTAINS', 20),
('MATERIAL_INSPECTION', '수량', 'CONTAINS', 20),
('MATERIAL_INSPECTION', '불량수량', 'CONTAINS', 20),
('MATERIAL_INSPECTION', '합격수량', 'CONTAINS', 20),
('DAILY_REPORT', '작업일보', 'CONTAINS', 20),
('DAILY_REPORT', '작업일자', 'CONTAINS', 20),
('DAILY_REPORT', '작업내용', 'CONTAINS', 20),
('DAILY_REPORT', '작업인원', 'CONTAINS', 20),
('DAILY_REPORT', '장비', 'CONTAINS', 20),
('DAILY_REPORT', '자재', 'CONTAINS', 20),
('DAILY_REPORT', '날씨', 'CONTAINS', 20),
('DAILY_REPORT', '공정률', 'CONTAINS', 20),
('DAILY_REPORT', '금일작업', 'CONTAINS', 20),
('DAILY_REPORT', '명일작업', 'CONTAINS', 20),
('DAILY_REPORT', '특이사항', 'CONTAINS', 20);
INSERT INTO document_type_rules (document_type, keyword, match_type, score, active_yn)
SELECT DISTINCT t.document_type, t.keyword, t.match_type, t.score, 'Y' FROM tmp_document_type_rules_seed_v2 t
WHERE NOT EXISTS (SELECT 1 FROM document_type_rules dtr WHERE dtr.document_type=t.document_type AND dtr.keyword=t.keyword);
DROP TEMPORARY TABLE IF EXISTS tmp_document_type_rules_seed_v2;

-- ---------------------------------------------------------
-- 4. 품목/합계/결제/제외 섹션 규칙 보강: 174건
-- ---------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_document_section_rules_seed_v2;
CREATE TEMPORARY TABLE tmp_document_section_rules_seed_v2 (document_type VARCHAR(50), section_type VARCHAR(30), keyword VARCHAR(100), match_type VARCHAR(30), target_field_key VARCHAR(100) NULL, priority INT) ENGINE=InnoDB;
INSERT INTO tmp_document_section_rules_seed_v2 (document_type, section_type, keyword, match_type, target_field_key, priority) VALUES
('ITEM_RECEIPT', 'ITEM_START', '상품명', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '상', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '품', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '명', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '품명', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '목', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '품목명', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '메뉴명', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '내역', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '물품명', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '제품명', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '단가', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '수량', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '금액', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_START', '판매금액', 'CONTAINS', 'item_name', 10),
('ITEM_RECEIPT', 'ITEM_END', '합계', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '총계', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '일계', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '일', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '계', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '판매합계', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '과세합계', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '소계', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '결제금액', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '신용카드', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '현금', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '카드승인', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '신용승인정보', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '승인정보', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '주문자', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '고객수', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '포인트', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '적립', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '대표자', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '사업자', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '주소', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '전화번호', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'ITEM_END', '가맹점번호', 'CONTAINS', 'total_amount', 20),
('ITEM_RECEIPT', 'SUMMARY', '합계', 'CONTAINS', 'total_amount', 15),
('ITEM_RECEIPT', 'SUMMARY', '총계', 'CONTAINS', 'total_amount', 15),
('ITEM_RECEIPT', 'SUMMARY', '일계', 'CONTAINS', 'total_amount', 15),
('ITEM_RECEIPT', 'SUMMARY', '일', 'CONTAINS', 'total_amount', 15),
('ITEM_RECEIPT', 'SUMMARY', '계', 'CONTAINS', 'total_amount', 15),
('ITEM_RECEIPT', 'SUMMARY', '판매합계', 'CONTAINS', 'total_amount', 15),
('ITEM_RECEIPT', 'SUMMARY', '합계금액', 'CONTAINS', 'total_amount', 15),
('ITEM_RECEIPT', 'SUMMARY', '총합계', 'CONTAINS', 'total_amount', 15),
('ITEM_RECEIPT', 'SUMMARY', '청구금액', 'CONTAINS', 'total_amount', 15),
('ITEM_RECEIPT', 'SUMMARY', '영수금액', 'CONTAINS', 'total_amount', 15),
('ITEM_RECEIPT', 'SUMMARY', '결제금액', 'CONTAINS', 'total_amount', 15),
('ITEM_RECEIPT', 'SUMMARY', '승인금액', 'CONTAINS', 'total_amount', 15),
('ITEM_RECEIPT', 'SUMMARY', '받을금액', 'CONTAINS', 'total_amount', 15),
('ITEM_RECEIPT', 'SUMMARY', '공급가액', 'CONTAINS', 'total_amount', 15),
('ITEM_RECEIPT', 'SUMMARY', '부가세', 'CONTAINS', 'total_amount', 15),
('ITEM_RECEIPT', 'SUMMARY', '부가가치세', 'CONTAINS', 'total_amount', 15),
('ITEM_RECEIPT', 'SUMMARY', '과세금액', 'CONTAINS', 'total_amount', 15),
('ITEM_RECEIPT', 'SUMMARY', '면세금액', 'CONTAINS', 'total_amount', 15),
('ITEM_RECEIPT', 'SUMMARY', '할인금액', 'CONTAINS', 'total_amount', 15),
('ITEM_RECEIPT', 'PAYMENT', '신용카드', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '체크카드', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '카드', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '현금', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '현금영수증', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '간편결제', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '카카오페이', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '네이버페이', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '삼성페이', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '제로페이', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '계좌이체', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '승인번호', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '승인일시', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '카드번호', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '할부', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '일시불', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '매입사', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'PAYMENT', '발급사', 'CONTAINS', 'payment_method', 20),
('ITEM_RECEIPT', 'DISCOUNT', '할인', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'DISCOUNT', '에누리', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'DISCOUNT', '쿠폰', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'DISCOUNT', '포인트', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'DISCOUNT', '적립', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'DISCOUNT', '사용포인트', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'DISCOUNT', '할인금액', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'DISCOUNT', '제휴할인', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'DISCOUNT', '프로모션', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'DISCOUNT', '캐시백', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'DISCOUNT', '멤버십', 'CONTAINS', 'discount_amount', 20),
('ITEM_RECEIPT', 'EXCLUDE', '사업자', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '사업자번호', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '사업자등록번호', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '대표자', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '주소', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '소재지', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '전화', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', 'TEL', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', 'Tel', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '연락처', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '가맹점번호', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '매장명', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '상호명', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '영수증번호', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '승인번호', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '승인일시', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '승인금액', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '카드번호', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '카드회원번호', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '신용승인정보', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '고객용', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '매입사', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '발급사', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '할부개월', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '일시불', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '포인트', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '적립', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '마일리지', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '쿠폰', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '이벤트', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '교환', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '환불', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '문의', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '본사', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '홈페이지', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '고객센터', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '주문자', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '고객수', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '테이블', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '배달주소', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '광고', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '과세', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '면세', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '부가세', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '공급가액', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '합계', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '총계', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '결제금액', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '받은금액', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '거스름돈', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '현금영수증', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '현금', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '승인정보', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '원산지', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '주차권', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', 'QR', 'CONTAINS', NULL, 10),
('ITEM_RECEIPT', 'EXCLUDE', '바코드', 'CONTAINS', NULL, 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '출발', 'CONTAINS', 'transport_type', 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '도착', 'CONTAINS', 'transport_type', 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '승차일', 'CONTAINS', 'transport_type', 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '승차일시', 'CONTAINS', 'transport_type', 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '열차', 'CONTAINS', 'transport_type', 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '버스', 'CONTAINS', 'transport_type', 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '택시', 'CONTAINS', 'transport_type', 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '운임', 'CONTAINS', 'transport_type', 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '좌석', 'CONTAINS', 'transport_type', 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '호차', 'CONTAINS', 'transport_type', 10),
('TRANSPORT_RECEIPT', 'ITEM_START', '승차권', 'CONTAINS', 'transport_type', 10),
('TRANSPORT_RECEIPT', 'SUMMARY', '운임', 'CONTAINS', 'total_amount', 20),
('TRANSPORT_RECEIPT', 'SUMMARY', '결제금액', 'CONTAINS', 'total_amount', 20),
('TRANSPORT_RECEIPT', 'SUMMARY', '승인금액', 'CONTAINS', 'total_amount', 20),
('TRANSPORT_RECEIPT', 'SUMMARY', '합계', 'CONTAINS', 'total_amount', 20),
('TRANSPORT_RECEIPT', 'SUMMARY', '총액', 'CONTAINS', 'total_amount', 20),
('TRANSPORT_RECEIPT', 'PAYMENT', '카드', 'CONTAINS', 'payment_method', 20),
('TRANSPORT_RECEIPT', 'PAYMENT', '현금', 'CONTAINS', 'payment_method', 20),
('TRANSPORT_RECEIPT', 'PAYMENT', '간편결제', 'CONTAINS', 'payment_method', 20),
('TRANSPORT_RECEIPT', 'PAYMENT', '승인번호', 'CONTAINS', 'payment_method', 20),
('TRANSPORT_RECEIPT', 'PAYMENT', '승인일시', 'CONTAINS', 'payment_method', 20),
('TRANSPORT_RECEIPT', 'EXCLUDE', '약관', 'CONTAINS', NULL, 20),
('TRANSPORT_RECEIPT', 'EXCLUDE', '환불', 'CONTAINS', NULL, 20),
('TRANSPORT_RECEIPT', 'EXCLUDE', '위약금', 'CONTAINS', NULL, 20),
('TRANSPORT_RECEIPT', 'EXCLUDE', '고객센터', 'CONTAINS', NULL, 20),
('TRANSPORT_RECEIPT', 'EXCLUDE', '홈페이지', 'CONTAINS', NULL, 20),
('TRANSPORT_RECEIPT', 'EXCLUDE', 'QR', 'CONTAINS', NULL, 20),
('TRANSPORT_RECEIPT', 'EXCLUDE', '바코드', 'CONTAINS', NULL, 20),
('TRANSPORT_RECEIPT', 'EXCLUDE', '사업자번호', 'CONTAINS', NULL, 20),
('TRANSPORT_RECEIPT', 'EXCLUDE', '대표자', 'CONTAINS', NULL, 20),
('TRANSPORT_RECEIPT', 'EXCLUDE', '주소', 'CONTAINS', NULL, 20);
INSERT INTO document_section_rules (document_type, section_type, keyword, match_type, target_field_key, priority, active_yn)
SELECT DISTINCT t.document_type, t.section_type, t.keyword, t.match_type, t.target_field_key, t.priority, 'Y' FROM tmp_document_section_rules_seed_v2 t
WHERE NOT EXISTS (SELECT 1 FROM document_section_rules dsr WHERE dsr.document_type=t.document_type AND dsr.section_type=t.section_type AND dsr.keyword=t.keyword);
DROP TEMPORARY TABLE IF EXISTS tmp_document_section_rules_seed_v2;

-- ---------------------------------------------------------
-- 5. 검증 규칙 추가/강화
-- ---------------------------------------------------------
INSERT INTO validation_rules (rule_code, rule_name, rule_type, standard_field_id, condition_json, severity, is_active)
SELECT 'ITEM_MIN_ROWS_CHECK', '상세 품목 최소 1건 검증', 'ITEM_CHECK', (SELECT id FROM standard_fields WHERE field_key = 'item_name'), JSON_OBJECT('min_rows', 1, 'document_types', JSON_ARRAY('RECEIPT','ITEM_RECEIPT')), 'ERROR', TRUE
WHERE NOT EXISTS (SELECT 1 FROM validation_rules WHERE rule_code = 'ITEM_MIN_ROWS_CHECK');
INSERT INTO validation_rules (rule_code, rule_name, rule_type, standard_field_id, condition_json, severity, is_active)
SELECT 'ITEM_FORMULA_QTY_UNIT_AMOUNT_CHECK', '수량×단가=금액 검증', 'ITEM_CHECK', (SELECT id FROM standard_fields WHERE field_key = 'amount'), JSON_OBJECT('quantity_field','quantity','unit_price_field','unit_price','amount_field','amount','tolerance',0), 'ERROR', TRUE
WHERE NOT EXISTS (SELECT 1 FROM validation_rules WHERE rule_code = 'ITEM_FORMULA_QTY_UNIT_AMOUNT_CHECK');
INSERT INTO validation_rules (rule_code, rule_name, rule_type, standard_field_id, condition_json, severity, is_active)
SELECT 'ITEM_SUM_TOTAL_STRICT_CHECK', '상세 품목 합계와 지출총액 엄격 검증', 'AMOUNT_CHECK', (SELECT id FROM standard_fields WHERE field_key = 'total_amount'), JSON_OBJECT('item_amount_field','amount','total_field','total_amount','tolerance',0), 'ERROR', TRUE
WHERE NOT EXISTS (SELECT 1 FROM validation_rules WHERE rule_code = 'ITEM_SUM_TOTAL_STRICT_CHECK');
INSERT INTO validation_rules (rule_code, rule_name, rule_type, standard_field_id, condition_json, severity, is_active)
SELECT 'CATEGORY_DETAIL_HEADER_CONSISTENCY', '상단 경비분류와 상세항목 분류 일관성 검증', 'CATEGORY_CHECK', (SELECT id FROM standard_fields WHERE field_key = 'expense_category_name'), JSON_OBJECT('header_field','expense_category_name','detail_field','expense_category_name','allow_empty_detail',true), 'WARNING', TRUE
WHERE NOT EXISTS (SELECT 1 FROM validation_rules WHERE rule_code = 'CATEGORY_DETAIL_HEADER_CONSISTENCY');
INSERT INTO validation_rules (rule_code, rule_name, rule_type, standard_field_id, condition_json, severity, is_active)
SELECT 'NO_NON_ITEM_AS_ITEM_CHECK', '합계/결제/승인정보 품목 혼입 차단', 'ITEM_CHECK', (SELECT id FROM standard_fields WHERE field_key = 'item_name'), JSON_OBJECT('exclude_sections', JSON_ARRAY('SUMMARY','PAYMENT','DISCOUNT','EXCLUDE')), 'ERROR', TRUE
WHERE NOT EXISTS (SELECT 1 FROM validation_rules WHERE rule_code = 'NO_NON_ITEM_AS_ITEM_CHECK');
INSERT INTO validation_rules (rule_code, rule_name, rule_type, standard_field_id, condition_json, severity, is_active)
SELECT 'TRANSPORT_ROUTE_FROM_TO_CHECK', '교통 영수증 출발지/도착지 검증', 'FORMAT_CHECK', (SELECT id FROM standard_fields WHERE field_key = 'departure_place'), JSON_OBJECT('required_together', JSON_ARRAY('departure_place','arrival_place'), 'not_equal', true), 'WARNING', TRUE
WHERE NOT EXISTS (SELECT 1 FROM validation_rules WHERE rule_code = 'TRANSPORT_ROUTE_FROM_TO_CHECK');
INSERT INTO validation_rules (rule_code, rule_name, rule_type, standard_field_id, condition_json, severity, is_active)
SELECT 'OCR_VERY_LOW_QUALITY_REVIEW', 'OCR 품질 낮음 검토 필요', 'CONFIDENCE_CHECK', NULL, JSON_OBJECT('min_ocr_quality',0.55,'action','NEED_REVIEW'), 'WARNING', TRUE
WHERE NOT EXISTS (SELECT 1 FROM validation_rules WHERE rule_code = 'OCR_VERY_LOW_QUALITY_REVIEW');
INSERT INTO validation_rules (rule_code, rule_name, rule_type, standard_field_id, condition_json, severity, is_active)
SELECT 'OCR_SUPPLEMENT_CANDIDATE_CHECK', '이미지 흐림/품질 문제 보완요청 후보 검증', 'FILE_CHECK', NULL, JSON_OBJECT('quality_ok_field','quality_ok','supplement_candidate_field','supplement_candidate'), 'WARNING', TRUE
WHERE NOT EXISTS (SELECT 1 FROM validation_rules WHERE rule_code = 'OCR_SUPPLEMENT_CANDIDATE_CHECK');
UPDATE validation_rules SET condition_json = JSON_OBJECT('item_amount_field','amount','total_field','total_amount','tolerance',0), severity='ERROR', is_active=TRUE WHERE rule_code IN ('ITEM_SUM_TOTAL_CHECK','ITEM_SUM_TOTAL_STRICT_CHECK');
UPDATE validation_rules SET condition_json = JSON_OBJECT('exclude_keywords', JSON_ARRAY('합계','총액','부가세','공급가액','승인금액','결제금액','카드번호','승인번호','현금영수증','포인트','사업자번호','대표자','주소','전화번호','가맹점번호')), severity='ERROR', is_active=TRUE WHERE rule_code = 'ITEM_NON_ITEM_KEYWORD_CHECK';

-- ---------------------------------------------------------
-- 6. 적용 확인
-- ---------------------------------------------------------
SELECT 'CATEGORY_RULES_APPROVED_ACTIVE' AS name, COUNT(*) AS cnt FROM correction_dictionaries WHERE dictionary_type='CATEGORY' AND status='APPROVED' AND active_yn='Y'
UNION ALL SELECT 'OCR_TEXT_RULES_APPROVED_ACTIVE', COUNT(*) FROM correction_dictionaries WHERE dictionary_type='OCR_TEXT' AND status='APPROVED' AND active_yn='Y'
UNION ALL SELECT 'ITEM_RULES_APPROVED_ACTIVE', COUNT(*) FROM correction_dictionaries WHERE dictionary_type='ITEM' AND status='APPROVED' AND active_yn='Y'
UNION ALL SELECT 'VENDOR_RULES_APPROVED_ACTIVE', COUNT(*) FROM correction_dictionaries WHERE dictionary_type='VENDOR' AND status='APPROVED' AND active_yn='Y'
UNION ALL SELECT 'PAYMENT_RULES_APPROVED_ACTIVE', COUNT(*) FROM correction_dictionaries WHERE dictionary_type='PAYMENT' AND status='APPROVED' AND active_yn='Y'
UNION ALL SELECT 'DOCUMENT_TYPE_RULES_ACTIVE', COUNT(*) FROM document_type_rules WHERE active_yn='Y'
UNION ALL SELECT 'DOCUMENT_SECTION_RULES_ACTIVE', COUNT(*) FROM document_section_rules WHERE active_yn='Y'
UNION ALL SELECT 'VALIDATION_RULES_ACTIVE', COUNT(*) FROM validation_rules WHERE is_active=TRUE;


ALTER TABLE source_files
  ADD COLUMN settlement_status VARCHAR(30) DEFAULT 'UNSETTLED' COMMENT 'UNSETTLED/READY_TO_SETTLE/SETTLED/ON_HOLD',
  ADD COLUMN settled_at DATETIME NULL COMMENT '결제/정산 완료일',
  ADD COLUMN settled_by INT NULL COMMENT '처리자 사용자 ID';

SET @table_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'source_files'
);

SET @sql := IF(@table_exists = 1, 'SELECT ''source_files exists'' AS message', 'SELECT ''source_files table not found'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- source_files 마감일/긴급도 컬럼 보강
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'source_files' AND COLUMN_NAME = 'expense_date');
SET @sql := IF(@table_exists = 1 AND @col_exists = 0, 'ALTER TABLE source_files ADD COLUMN expense_date DATE NULL COMMENT ''영수증 결제일/사용일자''', 'SELECT ''source_files.expense_date already exists or table missing'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'source_files' AND COLUMN_NAME = 'expense_date_status');
SET @sql := IF(@table_exists = 1 AND @col_exists = 0, 'ALTER TABLE source_files ADD COLUMN expense_date_status VARCHAR(30) DEFAULT ''UNKNOWN'' COMMENT ''NORMAL/MISSING/FUTURE_DATE/TOO_OLD/TOO_FAR_YEAR/SUSPICIOUS''', 'SELECT ''source_files.expense_date_status already exists or table missing'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'source_files' AND COLUMN_NAME = 'deadline_date');
SET @sql := IF(@table_exists = 1 AND @col_exists = 0, 'ALTER TABLE source_files ADD COLUMN deadline_date DATE NULL COMMENT ''통합 마감일: 기준일의 다음 달 5일''', 'SELECT ''source_files.deadline_date already exists or table missing'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'source_files' AND COLUMN_NAME = 'deadline_status');
SET @sql := IF(@table_exists = 1 AND @col_exists = 0, 'ALTER TABLE source_files ADD COLUMN deadline_status VARCHAR(30) DEFAULT ''NONE'' COMMENT ''OVERDUE/TODAY/DUE_SOON/NORMAL/ENOUGH/NONE''', 'SELECT ''source_files.deadline_status already exists or table missing'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'source_files' AND COLUMN_NAME = 'urgency_level');
SET @sql := IF(@table_exists = 1 AND @col_exists = 0, 'ALTER TABLE source_files ADD COLUMN urgency_level VARCHAR(20) DEFAULT ''NORMAL'' COMMENT ''URGENT/HIGH/NORMAL/LOW''', 'SELECT ''source_files.urgency_level already exists or table missing'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'source_files' AND COLUMN_NAME = 'urgency_rank');
SET @sql := IF(@table_exists = 1 AND @col_exists = 0, 'ALTER TABLE source_files ADD COLUMN urgency_rank INT DEFAULT 50 COMMENT ''긴급도 정렬 점수''', 'SELECT ''source_files.urgency_rank already exists or table missing'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 조회 성능용 인덱스
SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'source_files' AND INDEX_NAME = 'idx_source_files_deadline_status');
SET @sql := IF(@table_exists = 1 AND @idx_exists = 0, 'CREATE INDEX idx_source_files_deadline_status ON source_files(deadline_status, deadline_date)', 'SELECT ''idx_source_files_deadline_status already exists or table missing'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'source_files' AND INDEX_NAME = 'idx_source_files_urgency');
SET @sql := IF(@table_exists = 1 AND @idx_exists = 0, 'CREATE INDEX idx_source_files_urgency ON source_files(urgency_rank, urgency_level)', 'SELECT ''idx_source_files_urgency already exists or table missing'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =========================================================
-- CATEGORY 1글자 CONTAINS/FUZZY 매칭 비활성화
-- 목적: 대표자/사용자/주소 등 일반 문구와 충돌하는 1글자 카테고리 매칭 차단
-- =========================================================

-- 1) 비활성화 대상 확인
SELECT
  id,
  dictionary_type,
  wrong_text,
  corrected_text,
  match_type,
  document_type,
  priority,
  status,
  active_yn
FROM correction_dictionaries
WHERE dictionary_type = 'CATEGORY'
  AND UPPER(match_type) IN ('CONTAINS', 'FUZZY')
  AND CHAR_LENGTH(TRIM(wrong_text)) <= 1
ORDER BY corrected_text, wrong_text, priority;

-- 2) CATEGORY 1글자 포함/유사 매칭 비활성화
UPDATE correction_dictionaries
SET
  status = 'DISABLED',
  active_yn = 'N',
  description = CONCAT(
    COALESCE(description, ''),
    CASE WHEN COALESCE(description, '') = '' THEN '' ELSE ' / ' END,
    '비활성화: CATEGORY 1글자 포함매칭은 대표자/사용자/주소 등 일반 문구와 충돌하여 오분류 위험'
  ),
  updated_at = NOW()
WHERE dictionary_type = 'CATEGORY'
  AND UPPER(match_type) IN ('CONTAINS', 'FUZZY')
  AND CHAR_LENGTH(TRIM(wrong_text)) <= 1;

-- 3) 적용 결과 확인
SELECT
  corrected_text AS category,
  COUNT(*) AS disabled_count
FROM correction_dictionaries
WHERE dictionary_type = 'CATEGORY'
  AND status = 'DISABLED'
  AND active_yn = 'N'
  AND UPPER(match_type) IN ('CONTAINS', 'FUZZY')
  AND CHAR_LENGTH(TRIM(wrong_text)) <= 1
GROUP BY corrected_text
ORDER BY corrected_text;

SET FOREIGN_KEY_CHECKS = 1;
