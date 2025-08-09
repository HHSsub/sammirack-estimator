import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ProductContext = createContext();

const rackTypes = ['스텐랙', '하이랙', '경량랙', '중량랙', '파렛트랙'];
const formTypeRacks = ['경량랙', '중량랙', '파렛트랙'];
const versionRack = '스텐랙';

// 옵션값 변환 함수 (경량/중량/파렛트용)
const sizeToBom = size => size ? (size.startsWith('W') ? size : 'W' + size.replace('x', 'xD')) : '';
const heightToBom = height => height ? (height.startsWith('H') ? height : 'H' + height) : '';
const levelToBom = level => level ? (level.startsWith('L') ? level : 'L' + level.replace('단','')) : '';

export const ProductProvider = ({ children }) => {
  const [data, setData] = useState(null);
  const [bomData, setBomData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedType, setSelectedType] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(1);

  const [allOptions, setAllOptions] = useState({ types: [] });
  const [availableOptions, setAvailableOptions] = useState({});
  const [filteredOptions, setFilteredOptions] = useState({});

  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBOM, setCurrentBOM] = useState([]);

  const [cart, setCart] = useState([]);
  const [cartBOM, setCartBOM] = useState([]);

  const [applyRate, setApplyRate] = useState(100);
  const [customPrice, setCustomPrice] = useState(0);
  const [isCustomPrice, setIsCustomPrice] = useState(false);

  // fetch/로드
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [dRes, bRes] = await Promise.all([
          fetch('./data.json'),
          fetch('./bom_data.json')
        ]);
        const d = await dRes.json();
        const b = await bRes.json();

        setData(d);
        setBomData(b);
        setAllOptions({ types: Object.keys(d) });
      } catch (err) {
        console.error('데이터 로드 실패:', err);
        setData({});
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 옵션 세팅 useEffect (가장 중요)
  useEffect(() => {
    // 초기화
    setAvailableOptions({});
    setFilteredOptions({});

    if (!data || !selectedType) return;

    const rackData = data[selectedType];
    let opts = {};

    // 케이스별 분기
    if (selectedType === '스텐랙') {
      // 규격, 높이, 단수
      const sizes = Object.keys(rackData['기본가격'] || {});
      opts.size = sizes;

      if (selectedOptions.size) {
        const heights = Object.keys(rackData['기본가격'][selectedOptions.size] || {});
        opts.height = heights;
      }
      if (selectedOptions.size && selectedOptions.height) {
        const levels = Object.keys(
          rackData['기본가격'][selectedOptions.size][selectedOptions.height] || {}
        );
        opts.level = levels;
      }
      // 'version'은 무조건 'V1'로 설정 (UI 숨김!)
      opts.version = ['V1'];
    }
    else if (selectedType === '하이랙') {
      // 색상, 규격, 높이, 단수
      opts.color = rackData['색상'] || [];
      if (selectedOptions.color) {
        const sizes = Object.keys(rackData['기본가격'][selectedOptions.color] || {});
        opts.size = sizes;
        if (selectedOptions.size) {
          const heights = Object.keys(rackData['기본가격'][selectedOptions.color][selectedOptions.size] || {});
          opts.height = heights;
          if (selectedOptions.height) {
            const levels = Object.keys(
              rackData['기본가격'][selectedOptions.color][selectedOptions.size][selectedOptions.height] || {}
            );
            opts.level = levels;
          }
        }
      }
    }
    else if (formTypeRacks.includes(selectedType)) {
      // 구성형태, 규격, 높이, 단수
      opts.formType = Object.keys(rackData['기본가격'] || {});
      if (selectedOptions.formType) {
        opts.size = Object.keys(rackData['기본가격'][selectedOptions.formType] || {});
        if (selectedOptions.size) {
          opts.height = Object.keys(rackData['기본가격'][selectedOptions.formType][selectedOptions.size] || {});
          if (selectedOptions.height) {
            opts.level = Object.keys(
              rackData['기본가격'][selectedOptions.formType][selectedOptions.size][selectedOptions.height] || {}
            );
          }
        }
      }
    }
    setAvailableOptions(opts);
    console.log('[DEBUG] availableOptions:', opts);
  }, [selectedType, selectedOptions, data]);

  // 가격 계산
  const calculatePrice = useCallback(() => {
    if (!selectedType || !selectedOptions || !quantity) return 0;
    if (isCustomPrice) {
      return customPrice * quantity * (applyRate / 100);
    }
    if (formTypeRacks.includes(selectedType)) {
      // 옵션값 변환
      const formType = selectedOptions.formType;
      const size = sizeToBom(selectedOptions.size);
      const height = heightToBom(selectedOptions.height);
      const level = levelToBom(selectedOptions.level);
      const bomPrice =
        bomData?.[selectedType]?.[size]?.[height]?.[level]?.[formType]?.total_price;
      if (bomPrice) return bomPrice * quantity;
      // 없을 경우, data.json 가격
      const price =
        data?.[selectedType]?.['기본가격']?.[formType]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if (price) return price * quantity;
      return 0;
    }
    if (selectedType === '스텐랙') {
      const price =
        data?.스텐랙?.['기본가격']?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      return price ? price * quantity : 0;
    }
    if (selectedType === '하이랙') {
      const price =
        data?.하이랙?.['기본가격']?.[selectedOptions.color]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      return price ? price * quantity : 0;
    }
    return 0;
  }, [selectedType, selectedOptions, quantity, isCustomPrice, customPrice, applyRate, data, bomData]);

  // BOM 계산
  const calculateCurrentBOM = useCallback(() => {
    if (!selectedType || !selectedOptions || !quantity) return [];
    if (formTypeRacks.includes(selectedType)) {
      const formType = selectedOptions.formType;
      const size = sizeToBom(selectedOptions.size);
      const height = heightToBom(selectedOptions.height);
      const level = levelToBom(selectedOptions.level);
      const bom =
        bomData?.[selectedType]?.[size]?.[height]?.[level]?.[formType];
      if (bom && bom.components) {
        return bom.components.map(c => ({
          name: c.name,
          quantity: c.quantity * quantity,
          unitPrice: c.unit_price,
        }));
      }
      return [];
    }
    let levelCount = parseInt((selectedOptions.level || '').replace('단', '')) || 0;
    if (selectedType === '스텐랙') {
      return [
        { name: '기둥 4개', quantity: 4 * quantity },
        { name: `선반 ${levelCount}개`, quantity: levelCount * quantity },
        { name: '고정볼트세트', quantity: 1 * quantity },
      ];
    }
    if (selectedType === '하이랙') {
      return [
        { name: '기둥 4개', quantity: 4 * quantity },
        { name: '가로대', quantity: levelCount * quantity },
        { name: '선반', quantity: levelCount * quantity },
        { name: '고정볼트세트', quantity: 1 * quantity },
      ];
    }
    return [];
  }, [selectedType, selectedOptions, quantity, bomData, data]);

  // 장바구니 BOM
  const calculateCartBOM = useCallback(() => {
    const bom = cart.flatMap(item => {
      if (formTypeRacks.includes(item.type)) {
        const size = sizeToBom(item.options.size);
        const height = heightToBom(item.options.height);
        const level = levelToBom(item.options.level);
        const formType = item.options.formType;
        const found =
          bomData?.[item.type]?.[size]?.[height]?.[level]?.[formType];
        if (found && found.components) {
          return found.components.map(c => ({
            name: c.name,
            quantity: c.quantity * item.quantity,
            unitPrice: c.unit_price,
          }));
        }
        return [];
      }
      let levelCount =
        parseInt((item.options.level || '').replace('단', '')) || 0;
      if (item.type === '스텐랙') {
        return [
          { name: '기둥 4개', quantity: 4 * item.quantity },
          { name: `선반 ${levelCount}개`, quantity: levelCount * item.quantity },
          { name: '고정볼트세트', quantity: 1 * item.quantity },
        ];
      }
      if (item.type === '하이랙') {
        return [
          { name: '기둥 4개', quantity: 4 * item.quantity },
          { name: '가로대', quantity: levelCount * item.quantity },
          { name: '선반', quantity: levelCount * item.quantity },
          { name: '고정볼트세트', quantity: 1 * item.quantity },
        ];
      }
      return [];
    });
    return bom;
  }, [cart, bomData]);

  // 상태 업데이트
  useEffect(() => {
    setCurrentPrice(calculatePrice());
    setCurrentBOM(calculateCurrentBOM());
  }, [calculatePrice, calculateCurrentBOM]);

  useEffect(() => {
    setCartBOM(calculateCartBOM());
  }, [cart, calculateCartBOM]);

  // 옵션 변경 핸들러
  const handleOptionChange = (key, value) => {
    setSelectedOptions(prev => ({
      ...prev,
      [key]: value,
      ...(key === 'size' && { height: undefined, level: undefined }),
      ...(key === 'height' && { level: undefined }),
      // 스텐랙 버전 고정
      ...(key === 'type' && value === '스텐랙' ? { version: 'V1' } : {})
    }));
  };

  // 장바구니 추가
  const addToCart = () => {
    if (!selectedType || !selectedOptions) return;
    setCart(prev => [
      ...prev,
      {
        type: selectedType,
        options: { ...selectedOptions },
        quantity,
        price: currentPrice,
      }
    ]);
  };

  // UI 표시 가격 formatting
  const safePrice = price => Math.round(price).toLocaleString();

  // Context 제공
  return (
    <ProductContext.Provider
      value={{
        allOptions,
        availableOptions,
        filteredOptions,
        selectedType,
        selectedOptions,
        setSelectedType,
        handleOptionChange,
        quantity,
        setQuantity,
        applyRate,
        setApplyRate,
        customPrice,
        setCustomPrice,
        isCustomPrice,
        setIsCustomPrice,
        currentPrice,
        currentBOM,
        cart,
        cartBOM,
        loading,
        addToCart,
        safePrice,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
