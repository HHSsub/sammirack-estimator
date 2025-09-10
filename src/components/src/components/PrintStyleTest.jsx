import React, { useState } from 'react';
import GyeonjukPrint from './GyeonjukPrint';
import BaljuPrint from './BaljuPrint';
import '../styles/PrintStyles.css';

const PrintStyleTest = () => {
  const [activeTab, setActiveTab] = useState('gyeonjuk');

  const sampleGyeonjukData = {
    date: '2025-07-24',
    estimateNumber: 'EST-20250724-0001',
    customerName: '테스트 고객',
    contactInfo: '010-1234-5678',
    items: [
      {
        name: '중량랙(독립형)',
        specification: '1500x600x1500 (4단)',
        unit: 'set',
        quantity: 1,
        unitPrice: 102600,
        totalPrice: 102600,
        note: ''
      },
      {
        name: '중량랙(연결형)',
        specification: '1500x600x2100 (4단)',
        unit: 'set',
        quantity: 1,
        unitPrice: 94140,
        totalPrice: 94140,
        note: ''
      }
    ],
    notes: '테스트 비고사항',
    subtotal: 196740,
    tax: 19674,
    totalAmount: 216414
  };

  const sampleBaljuData = {
    ...sampleGyeonjukData,
    orderNumber: 'PO-20250724-0001',
    materials: [
      {
        name: '철재 파이프',
        specification: '50mm x 2.5m',
        unit: '개',
        quantity: 20,
        unitPrice: 5000,
        totalPrice: 100000,
        note: ''
      },
      {
        name: '볼트',
        specification: 'M12 x 50mm',
        unit: '개',
        quantity: 100,
        unitPrice: 200,
        totalPrice: 20000,
        note: ''
      }
    ]
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => setActiveTab('gyeonjuk')}
          style={{ 
            marginRight: '10px', 
            padding: '10px 20px',
            backgroundColor: activeTab === 'gyeonjuk' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'gyeonjuk' ? 'white' : 'black',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          견적서 테스트
        </button>
        <button 
          onClick={() => setActiveTab('balju')}
          style={{ 
            marginRight: '10px',
            padding: '10px 20px',
            backgroundColor: activeTab === 'balju' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'balju' ? 'white' : 'black',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          발주서 테스트
        </button>
        <button 
          onClick={() => window.print()}
          style={{ 
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          프린트 테스트
        </button>
      </div>

      {activeTab === 'gyeonjuk' && <GyeonjukPrint data={sampleGyeonjukData} />}
      {activeTab === 'balju' && <BaljuPrint data={sampleBaljuData} />}
    </div>
  );
};

export default PrintStyleTest;
