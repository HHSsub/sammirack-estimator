import React from 'react';

/**
 * Component for displaying BOM (Bill of Materials) data
 */
const BOMDisplay = ({ components, showPrices = true, className = '' }) => {
  if (!components || components.length === 0) {
    return (
      <div className="p-4 text-center bg-gray-100 rounded-md">
        <p>BOM 데이터가 없습니다.</p>
      </div>
    );
  }

  const total = components.reduce((sum, comp) => sum + (comp.totalPrice || 0), 0);

  return (
    <div className={`overflow-auto ${className}`}>
      <table className="w-full border-collapse">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 border text-left">항목</th>
            <th className="p-2 border text-left">설명</th>
            <th className="p-2 border text-center">수량</th>
            <th className="p-2 border text-center">단위</th>
            {showPrices && (
              <>
                <th className="p-2 border text-right">단가</th>
                <th className="p-2 border text-right">금액</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {components.map((component, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="p-2 border">{component.name}</td>
              <td className="p-2 border">{component.description}</td>
              <td className="p-2 border text-center">{component.quantity}</td>
              <td className="p-2 border text-center">{component.unit}</td>
              {showPrices && (
                <>
                  <td className="p-2 border text-right">
                    {component.unitPrice?.toLocaleString()}원
                  </td>
                  <td className="p-2 border text-right">
                    {component.totalPrice?.toLocaleString()}원
                  </td>
                </>
              )}
            </tr>
          ))}
          {showPrices && (
            <tr className="font-bold bg-gray-100">
              <td colSpan="5" className="p-2 border text-right">총계</td>
              <td className="p-2 border text-right">{total.toLocaleString()}원</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default BOMDisplay;