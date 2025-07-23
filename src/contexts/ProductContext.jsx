import React, { createContext, useState, useEffect, useContext } from 'react';
import { BOMCalculator } from '../utils/BOMCalculator';

const ProductContext = createContext();
const bomCalculator = new BOMCalculator();

export const ProductProvider = ({ children }) => {
  const [productsData, setProductsData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selections, setSelections] = useState({
    type: '',
    version: '', // 스텐랙 버전은 가격에 직접 영향을 주지 않고, 설명 등에 활용될 수 있음
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

    const { type, color, size, height, level, quantity } = selections;
    const product = productsData[type];

    // 1. 동적 옵션 목록 업데이트
    const newOptions = { versions: [], sizes: [], heights: [], levels: [], colors: [] };
    if (product) {
      if (product.버전) newOptions.versions = Object.keys(product.버전);
      if (product.색상) newOptions.colors = product.색상;
      
      const priceData = product.기본가격;
      if (priceData) {
        const sizeSource = type === '하이랙' && color ? priceData[color] : priceData;
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

    // 2. 가격 계산 (로직 수정)
    let unitPrice = 0;
    try {
      if (type && size && height && level) {
        if (type === '스텐랙') {
          unitPrice = product.기본가격[size][height][level];
        } else if (type === '하이랙' && color) {
          unitPrice = product.기본가격[color][size][height][level];
        }
      }
    } catch (e) {
      unitPrice = 0;
    }
    setPrice(unitPrice * (quantity || 1));

    // 3. BOM 계산
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
