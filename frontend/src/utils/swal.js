import Swal from "sweetalert2";

const defaultConfirmButtonColor = "#111827";
const defaultCancelButtonColor = "#94a3b8";

export const alertSuccess = async (
  title = "완료",
  text = "정상적으로 처리되었습니다."
) => {
  return Swal.fire({
    icon: "success",
    title,
    text,
    confirmButtonText: "확인",
    confirmButtonColor: defaultConfirmButtonColor,
  });
};

export const alertError = async (
  title = "오류",
  text = "처리 중 오류가 발생했습니다."
) => {
  return Swal.fire({
    icon: "error",
    title,
    text,
    confirmButtonText: "확인",
    confirmButtonColor: defaultConfirmButtonColor,
  });
};

export const alertWarning = async (
  title = "확인 필요",
  text = "입력 내용을 확인해주세요."
) => {
  return Swal.fire({
    icon: "warning",
    title,
    text,
    confirmButtonText: "확인",
    confirmButtonColor: defaultConfirmButtonColor,
  });
};

export const alertInfo = async (
  title = "안내",
  text = "내용을 확인해주세요."
) => {
  return Swal.fire({
    icon: "info",
    title,
    text,
    confirmButtonText: "확인",
    confirmButtonColor: defaultConfirmButtonColor,
  });
};

export const confirmLogout = async () => {
  return Swal.fire({
    icon: "question",
    title: "로그아웃하시겠습니까?",
    text: "현재 계정에서 로그아웃됩니다.",
    showCancelButton: true,
    confirmButtonText: "로그아웃",
    cancelButtonText: "취소",
    confirmButtonColor: "#ef4444",
    cancelButtonColor: defaultCancelButtonColor,
    reverseButtons: true,
  });
};

export const confirmDelete = async (
  title = "삭제하시겠습니까?",
  text = "삭제한 데이터는 복구하기 어렵습니다."
) => {
  return Swal.fire({
    icon: "warning",
    title,
    text,
    showCancelButton: true,
    confirmButtonText: "삭제",
    cancelButtonText: "취소",
    confirmButtonColor: "#ef4444",
    cancelButtonColor: defaultCancelButtonColor,
    reverseButtons: true,
  });
};

export const confirmSave = async (
  title = "저장하시겠습니까?",
  text = "입력한 내용이 저장됩니다."
) => {
  return Swal.fire({
    icon: "question",
    title,
    text,
    showCancelButton: true,
    confirmButtonText: "저장",
    cancelButtonText: "취소",
    confirmButtonColor: defaultConfirmButtonColor,
    cancelButtonColor: defaultCancelButtonColor,
    reverseButtons: true,
  });
};

export const confirmActivate = async (
  title = "활성화하시겠습니까?",
  text = "활성화 후에는 현재 템플릿과 매핑이 사용됩니다."
) => {
  return Swal.fire({
    icon: "question",
    title,
    text,
    showCancelButton: true,
    confirmButtonText: "활성화",
    cancelButtonText: "취소",
    confirmButtonColor: "#2563eb",
    cancelButtonColor: defaultCancelButtonColor,
    reverseButtons: true,
  });
};

export const toastSuccess = (title = "처리되었습니다.") => {
  return Swal.fire({
    toast: true,
    position: "top-end",
    icon: "success",
    title,
    showConfirmButton: false,
    timer: 1800,
    timerProgressBar: true,
  });
};

export const toastError = (title = "오류가 발생했습니다.") => {
  return Swal.fire({
    toast: true,
    position: "top-end",
    icon: "error",
    title,
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true,
  });
};