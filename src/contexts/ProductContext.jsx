import React, { createContext, useState, useEffect, useContext } from 'react';
import { BOMCalculator } from '../utils/BOMCalculator';

const ProductContext = createContext();
const bomCalculator = new BOMCalculator();

export const ProductProvider = ({ children }) => {
  const [productsData, setProductsData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selections, setSelections] = useState({
    type: '',
    version: '',
    color: '',
    size: '',
    height: '',
    level: '',
    quantity: 1,
  });

  const [price, setPrice] = useState(0);
  const [bom, setBom] = useState([]);

  const [availableOptions, setAvailableOptions] = useState({
    versions: [], sizes: [], heights: [], levels: [], colors: []
  });

  useEffect(() => {
    fetch('/sammirack-estimator/data.json')
      .then(res => res.json())
      .then(data => {
        setProductsData(data);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!productsData) return;

    const { type, version, color, size, height, level, quantity } = selections;
    const product = productsData[type];

    // 1. 동적 옵션 목록 업데이트 (이전과 동일하지만, 로직의 정확성을 위해 다시 포함)
    const newOptions = { versions: [], sizes: [], heights: [], levels: [], colors: [] };
    if (product) {
      if (product.버전) newOptions.versions = Object.keys(product.버전);
      if (product.색상) newOptions.colors = product.색상;
      
      const priceDataSource = product.기본가격;
      if (priceDataSource) {
        const sizeSource = type === '하이랙' && color ? priceDataSource[color] : priceDataSource;
        if (sizeSource) {
          newOptions.sizes = Object.keys(sizeSource);
          if (size && sizeSource[size]) {
            newOptions.heights = Object.keys(sizeSource[size]);
            if (height && sizeSource[size][height]) {
              newOptions.levels = Object.keys(sizeSource[size][height]);
            }
          }
        }
      }
    }
    setAvailableOptions(newOptions);

    // 2. 가격 계산 (대표님 로직을 100% 반영하여 전면 수정)
    let unitPrice = 0;
    try {
      if (type === '스텐랙' && size && height && level) {
        // 2-1. V1 기준 가격을 먼저 찾습니다.
        const basePriceV1 = product.기본가격[size][height][level];
        
        if (version) {
          // 2-2. 선택한 버전의 가격을 찾습니다.
          const versionPrice = product.버전[version].기본가;
          // 2-3. V1 기준가(185,000)와 선택한 버전 가격의 '차액'을 계산합니다.
          const priceDifference = versionPrice - product.버전['기본형 V1'].기본가;
          // 2-4. 기준가에 차액을 더합니다. (V2 선택 시 -10000, V3 선택 시 -20000이 더해짐)
          unitPrice = basePriceV1 + priceDifference;
        } else {
          // 버전을 선택하지 않으면 가격을 0으로 처리하여 선택을 유도
          unitPrice = 0;
        }
      } else if (type === '하이랙' && color && size && height && level) {
        // 하이랙은 구조가 단순하므로 직접 가격을 찾습니다.
        unitPrice = product.기본가격[color][size][height][level];
      }
    } catch (e) {
      unitPrice = 0; // 경로상에 없는 옵션 조합일 경우 0으로 처리
    }
    setPrice(unitPrice * (quantity || 1));

    // 3. BOM 계산 (부품구성 무시 지시에 따라, 이 부분은 그대로 유지)
    const newBom = bomCalculator.calculateBOM(type, selections);
    setBom(newBom);

  }, [productsData, selections]);

  const value = {
    loading,
    productsData,
    selections,
    setSelections,
    availableOptions,
    price,
    bom,
  };

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
};

export const useProducts = () => useContext(ProductContext);
