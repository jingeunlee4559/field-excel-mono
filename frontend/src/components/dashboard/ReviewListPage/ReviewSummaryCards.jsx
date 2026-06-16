import { FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiFileText, FiXCircle } from 'react-icons/fi';
import ReviewSummaryCard from './ReviewSummaryCard';

const ReviewSummaryCards = ({ summary, status, onStatusChange }) => (
  <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
    <ReviewSummaryCard title="전체 자료" value={summary.total} icon={FiFileText} tone="blue" active={status === ''} onClick={() => onStatusChange('')} />
    <ReviewSummaryCard title="검토 필요" value={summary.needReview} icon={FiAlertTriangle} tone="amber" active={status === 'NEED_REVIEW'} onClick={() => onStatusChange('NEED_REVIEW')} />
    <ReviewSummaryCard title="보완 필요" value={summary.supplement} icon={FiAlertCircle} tone="rose" active={status === 'NEED_SUPPLEMENT'} onClick={() => onStatusChange('NEED_SUPPLEMENT')} />
    <ReviewSummaryCard title="확정 가능" value={summary.normal} icon={FiCheckCircle} tone="emerald" active={status === 'NORMAL'} onClick={() => onStatusChange('NORMAL')} />
    <ReviewSummaryCard title="확정 완료" value={summary.confirmed} icon={FiCheckCircle} tone="blue" active={status === 'CONFIRMED'} onClick={() => onStatusChange('CONFIRMED')} />
    <ReviewSummaryCard title="처리 실패" value={summary.failed} icon={FiXCircle} tone="red" active={status === 'FAILED'} onClick={() => onStatusChange('FAILED')} />
  </section>
);

export default ReviewSummaryCards;
