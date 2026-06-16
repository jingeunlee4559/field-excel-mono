import { FiAlertCircle, FiCheckCircle, FiCreditCard, FiLayers } from 'react-icons/fi';
import ManagerSummaryCard from './ManagerSummaryCard';

const ManagerSummaryCards = ({
  summary,
  confirmedFileCount,
  excludedFileCount,
  reviewExcludedCount,
  failedExcludedCount,
  formatMoney,
  formatNumber,
}) => (
  <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <ManagerSummaryCard
      label="확정 배치"
      value={formatNumber(summary?.batchCount)}
      icon={FiLayers}
      tone="slate"
      caption="최종확정 자료가 있는 배치"
    />
    <ManagerSummaryCard
      label="확정 자료"
      value={formatNumber(confirmedFileCount)}
      icon={FiCheckCircle}
      tone="emerald"
      caption="구매 내역 반영 대상"
    />
    <ManagerSummaryCard
      label="확정 금액"
      value={formatMoney(summary?.totalAmount)}
      icon={FiCreditCard}
      tone="blue"
      caption="확정 자료 기준 합계"
    />
    <ManagerSummaryCard
      label="검토 제외"
      value={formatNumber(excludedFileCount)}
      icon={FiAlertCircle}
      tone="amber"
      caption={`검토/보완 ${formatNumber(reviewExcludedCount)} · 실패 ${formatNumber(failedExcludedCount)}`}
    />
  </section>
);

export default ManagerSummaryCards;
