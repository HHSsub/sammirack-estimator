import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const ProductContext = createContext();

export const ProductProvider = ({ children }) => {
  const [selectedType, setSelectedType] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [isCustomPrice, setIsCustomPrice] = useState(false);
  const [customPrice, setCustomPrice] = useState(0);
  const [applyRate, setApplyRate] = useState(100);
  const [price, setPrice] = useState(0);
  const [data, setData] = useState(null);
  const [bomData, setBomData] = useState(null);
  const [currentBOM, setCurrentBOM] = useState(null);

  // JSON 데이터 로드
  useEffect(() => {
    fetch('./data.json')
      .then(res => res.json())
      .then(setData)
      .catch(console.error);

    fetch('./bom_data.json')
      .then(res => res.json())
      .then(setBomData)
      .catch(console.error);
  }, []);

  // 옵션 필터링
  const filteredOptions = useMemo(() => {
    if (!selectedType || !data?.products) return {};

    const productOptions = data.products
      .filter(product => product.type === selectedType)
      .reduce((acc, product) => {
        Object.keys(product).forEach(key => {
          if (key !== 'type' && key !== 'price' && key !== 'id') {
            acc[key] = acc[key] || new Set();
            acc[key].add(product[key]);
          }
        });
        return acc;
      }, {});

    if (['light', 'heavy', 'pallet'].includes(selectedType)) {
      productOptions.formType = new Set(['독립형', '연결형']);
    }

    if (selectedType === 'stand') {
      delete productOptions.version;
    }

    return Object.fromEntries(
      Object.entries(productOptions).map(([key, value]) => [
        key,
        Array.from(value).map(v => ({ value: v, label: v }))
      ])
    );
  }, [selectedType, data]);

  // BOM 계산
  const calculateBOM = useCallback(() => {
    if (!selectedType || !bomData || !selectedOptions) return null;

    if (['light', 'heavy', 'pallet'].includes(selectedType)) {
      const bomList = bomData[selectedType];
      const { size, height, level, formType } = selectedOptions;

      return bomList?.find(item => 
        item.size === size &&
        item.height === height &&
        item.level === level &&
        item.formType === formType
      )?.components || null;
    }
    return null;
  }, [selectedType, selectedOptions, bomData]);

  // 가격 계산
  const calculatePrice = useCallback(() => {
    if (!selectedType || !selectedOptions || !quantity) return 0;

    if (isCustomPrice) {
      return customPrice * quantity * (applyRate / 100);
    }

    if (['light', 'heavy', 'pallet'].includes(selectedType)) {
      const bomList = bomData?.[selectedType];
      const { size, height, level, formType } = selectedOptions;

      const matchedBOM = bomList?.find(item => 
        item.size === size &&
        item.height === height &&
        item.level === level &&
        item.formType === formType
      );

      return matchedBOM ? matchedBOM.total_price * quantity : 0;
    }

    const matchedProduct = data?.products?.find(product => 
      product.type === selectedType &&
      Object.keys(selectedOptions).every(
        key => product[key] === selectedOptions[key]
      )
    );

    return matchedProduct ? matchedProduct.price * quantity : 0;
  }, [selectedType, selectedOptions, quantity, isCustomPrice, customPrice, applyRate, data, bomData]);

  // 옵션 변경 시 BOM 업데이트
  useEffect(() => {
    setCurrentBOM(calculateBOM());
  }, [selectedOptions, calculateBOM]);

  // 가격 업데이트
  useEffect(() => {
    setPrice(calculatePrice());
  }, [calculatePrice]);

  // 타입 변경 시 초기화
  useEffect(() => {
    setSelectedOptions({});
    setIsCustomPrice(false);
    setCustomPrice(0);
    setCurrentBOM(null);
  }, [selectedType]);

  return (
    <ProductContext.Provider
      value={{
        data,
        selectedType,
        setSelectedType,
        filteredOptions,
        selectedOptions,
        handleOptionChange: (key, value) => {
          setSelectedOptions(prev => ({ ...prev, [key]: value }));
        },
        quantity,
        setQuantity,
        price,
        isCustomPrice,
        setIsCustomPrice,
        customPrice,
        setCustomPrice,
        applyRate,
        setApplyRate,
        currentBOM,
        bomData
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProduct = () => useContext(ProductContext);
