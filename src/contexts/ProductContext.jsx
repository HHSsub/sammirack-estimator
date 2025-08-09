import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ProductContext = createContext();

const rackTypes = ['스텐랙', '하이랙', '경량랙', '중량랙', '파렛트랙'];
const formTypeRacks = ['경량랙', '중량랙', '파렛트랙'];
const versionRack = '스텐랙';

const optionKeys = {
  스텐랙: ['size', 'height', 'level'],
  하이랙: ['color', 'size', 'height', 'level'],
  경량랙: ['formType', 'size', 'height', 'level'],
  중량랙: ['formType', 'size', 'height', 'level'],
  파렛트랙: ['formType', 'size', 'height', 'level']
};

// 옵션값 변환 함수 (경량/중량/파렛트용)
const sizeToBom = size => /^W/.test(size) ? size : 'W' + size.replace('x', 'xD');
const heightToBom = height => /^H/.test(height) ? height : 'H' + height;
const levelToBom = level => /^L/.test(level) ? level : 'L' + level.replace('단','');

export const ProductProvider = ({ children }) => {
  const [data, setData] = useState(null);
  const [bomData, setBomData] = useState(null);
  const [loading, setLoading] = useState(true);

  // 선택 상태
  const [selectedType, setSelectedType] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(1);

  // 옵션 표시
  const [allOptions, setAllOptions] = useState({ types: [] });
  const [availableOptions, setAvailableOptions] = useState({});
  const [filteredOptions, setFilteredOptions] = useState({});

  // 가격/BOM
  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBOM, setCurrentBOM] = useState([]);

  // 장바구니
  const [cart, setCart] = useState([]);
  const [cartBOM, setCartBOM] = useState([]);

  // 가격 입력 관련
  const [applyRate, setApplyRate] = useState(100);
  const [customPrice, setCustomPrice] = useState(0);
  const [isCustomPrice, setIsCustomPrice] = useState(false);

  // fetch/로드
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [dRes, bRes] = await Promise.all([
          fetch('/data.json'), // public 폴더 배포 기준 경로
          fetch('/bom_data.json')
        ]);
        const d = await dRes.json();
        const b = await bRes.json();

        setData(d);
        setBomData(b);
        setAllOptions({ types: Object.keys(d) });
      } catch (err) {
        console.error('데이터 로드 실패:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 옵션 설정 로직별 adapter
  useEffect(() => {
    if (loading || !data || !selectedType) {
      setAvailableOptions({});
      setFilteredOptions({});
      return;
    }

    const rackData = data[selectedType];
    let opts = {};
    let filtered = {};

    if (selectedType === '스텐랙') {
      // 규격, 높이, 단수
      const sizes = Object.keys(rackData['기본가격']);
      opts.size = sizes;

      if (selectedOptions.size) {
        const heights = Object.keys(rackData['기본가격'][selectedOptions.size]);
        opts.height = heights;
      }
      if (selectedOptions.size && selectedOptions.height) {
        const levels = Object.keys(rackData['기본가격'][selectedOptions.size][selectedOptions.height]);
        opts.level = levels;
      }
    } else if (selectedType === '하이랙') {
      // 색상, 규격, 높이, 단수
      opts.color = rackData['색상'];
      if (selectedOptions.color) {
        const sizes = Object.keys(rackData['기본가격'][selectedOptions.color] || {});
        opts.size = sizes;
        if (selectedOptions.size) {
          const heights = Object.keys(rackData['기본가격'][selectedOptions.color][selectedOptions.size] || {});
          opts.height = heights;
          if (selectedOptions.height) {
            const levels = Object.keys(rackData['기본가격'][selectedOptions.color][selectedOptions.size][selectedOptions.height] || {});
            opts.level = levels;
          }
        }
      }
    } else if (formTypeRacks.includes(selectedType)) {
      // 구성형태, 규격, 높이, 단수
      opts.formType = Object.keys(rackData['기본가격']);
      if (selectedOptions.formType) {
        const sizes = Object.keys(rackData['기본가격'][selectedOptions.formType] || {});
        opts.size = sizes;
        if (selectedOptions.size) {
          const heights = Object.keys(rackData['기본가격'][selectedOptions.formType][selectedOptions.size] || {});
          opts.height = heights;
          if (selectedOptions.height) {
            const levels = Object.keys(rackData['기본가격'][selectedOptions.formType][selectedOptions.size][selectedOptions.height] || {});
            opts.level = levels;
          }
        }
      }
    }
    setAvailableOptions(opts);
    setFilteredOptions(filtered);
  }, [selectedType, selectedOptions, data, loading]);

  // 가격 계산
  const calculatePrice = useCallback(() => {
    if (loading || !selectedType || !selectedOptions || !quantity) return 0;
    if (isCustomPrice) {
      return customPrice * quantity * (applyRate / 100);
    }

    // BOM 기준 rack
    if (formTypeRacks.includes(selectedType)) {
      // 옵션값 변환
      const formType = selectedOptions.formType;
      const size = sizeToBom(selectedOptions.size);
      const height = heightToBom(selectedOptions.height);
      const level = levelToBom(selectedOptions.level);

      // BOM 가격 우선, 없을 경우 data.json
      const bomPrice =
        bomData?.[selectedType]?.[size]?.[height]?.[level]?.[formType]?.total_price;
      if (bomPrice) return bomPrice * quantity;

      // 만약 BOM 없는 경우, data.json 가격
      const price =
        data?.[selectedType]?.['기본가격']?.[formType]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if (price) return price * quantity;

      return 0;
    }

    // 스텐랙
    if (selectedType === '스텐랙') {
      const price =
        data?.스텐랙?.['기본가격']?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      return price ? price * quantity : 0;
    }

    // 하이랙
    if (selectedType === '하이랙') {
      const price =
        data?.하이랙?.['기본가격']?.[selectedOptions.color]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      return price ? price * quantity : 0;
    }
    return 0;
  }, [selectedType, selectedOptions, quantity, isCustomPrice, customPrice, applyRate, data, bomData, loading]);

  // BOM 추출
  const calculateCurrentBOM = useCallback(() => {
    if (loading || !selectedType || !selectedOptions || !quantity) return [];

    if (formTypeRacks.includes(selectedType)) {
      const formType = selectedOptions.formType;
      const size = sizeToBom(selectedOptions.size);
      const height = heightToBom(selectedOptions.height);
      const level = levelToBom(selectedOptions.level);

      // BOM
      const bom =
        bomData?.[selectedType]?.[size]?.[height]?.[level]?.[formType];
      if (bom && bom.components) {
        return bom.components.map(c => ({
          name: c.name,
          quantity: c.quantity * quantity,
          unitPrice: c.unit_price,
        }));
      }
      // 만약 BOM 못찾으면 빈배열
      return [];
    }

    // 스텐랙/하이랙: 규칙기반 생성(부품구성 활용. 필요하다면 커스터마이즈)
    let levelCount = parseInt((selectedOptions.level || '').replace('단', '')) || 0;
    if (selectedType === '스텐랙') {
      return [
        { name: '기둥', quantity: 4 * quantity, unitPrice: null },
        { name: '선반', quantity: levelCount * quantity, unitPrice: null },
        { name: '고정볼트세트', quantity: 1 * quantity, unitPrice: null },
      ];
    }
    if (selectedType === '하이랙') {
      // 색상 종류에 따라 부품구성 달라질 수 있음(700kg? etc)
      // 원칙상 data['부품구성'] 참고. 여기선 기본 예시.
      return [
        { name: '기둥', quantity: 4 * quantity, unitPrice: null },
        { name: '가로대', quantity: levelCount * quantity, unitPrice: null },
        { name: '선반', quantity: levelCount * quantity, unitPrice: null },
        { name: '고정볼트세트', quantity: 1 * quantity, unitPrice: null },
      ];
    }
    return [];
  }, [selectedType, selectedOptions, quantity, bomData, data, loading]);

  // 장바구니BOM
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
      // 스텐랙/하이랙
      let levelCount =
        parseInt((item.options.level || '').replace('단', '')) || 0;
      if (item.type === '스텐랙') {
        return [
          { name: '기둥', quantity: 4 * item.quantity, unitPrice: null },
          { name: '선반', quantity: levelCount * item.quantity, unitPrice: null },
          { name: '고정볼트세트', quantity: 1 * item.quantity, unitPrice: null },
        ];
      }
      if (item.type === '하이랙') {
        return [
          { name: '기둥', quantity: 4 * item.quantity, unitPrice: null },
          { name: '가로대', quantity: levelCount * item.quantity, unitPrice: null },
          { name: '선반', quantity: levelCount * item.quantity, unitPrice: null },
          { name: '고정볼트세트', quantity: 1 * item.quantity, unitPrice: null },
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

  // Context 값 제공
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
