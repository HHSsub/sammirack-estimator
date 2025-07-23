import React, { createContext, useState, useEffect, useContext } from 'react';
import { BOMCalculator } from '../utils/BOMCalculator';

const ProductContext = createContext();
const bomCalculator = new BOMCalculator();

export const ProductProvider = ({ children }) => {
  const [productsData, setProductsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]); // 1. 장바구니 상태 추가

  const [selections, setSelections] = useState({
    type: '', version: '', color: '', size: '', height: '', level: '', quantity: 1,
  });

  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBom, setCurrentBom] = useState([]);

  useEffect(() => {
    fetch('/sammirack-estimator/data.json')
      .then(res => res.json())
      .then(data => { setProductsData(data); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!productsData) return;
    const { type, version, color, size, height, level, quantity } = selections;
    const product = productsData[type];

    let unitPrice = 0;
    try {
      if (type === '스텐랙' && version && size && height && level) {
        const baseOptionPrice = product.기본가격[size][height][level];
        const versionBasePrice = product.버전[version].기본가;
        const v1BasePrice = product.버전['기본형 V1'].기본가;
        const priceDifference = versionBasePrice - v1BasePrice;
        unitPrice = baseOptionPrice + priceDifference;
      } else if (type === '하이랙' && color && size && height && level) {
        unitPrice = product.기본가격[color][size][height][level];
      }
    } catch (e) { unitPrice = 0; }
    
    setCurrentPrice(unitPrice * (quantity || 1));
    // 2. BOM 계산 시 수량(quantity)을 인자로 전달
    setCurrentBom(bomCalculator.calculateBOM(type, selections, quantity || 1));

  }, [productsData, selections]);

  // 3. 장바구니 관리 함수
  const addToCart = () => {
    if (currentPrice > 0) {
      const newItem = {
        id: Date.now(), // 고유 ID
        selections,
        price: currentPrice,
        bom: currentBom,
      };
      setCart(prevCart => [...prevCart, newItem]);
    } else {
      alert("가격을 계산할 수 없는 항목은 추가할 수 없습니다.");
    }
  };

  const removeFromCart = (id) => {
    setCart(prevCart => prevCart.filter(item => item.id !== id));
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((total, item) => total + item.price, 0);

  const value = {
    loading, productsData, selections, setSelections, availableOptions: getAvailableOptions(productsData, selections),
    currentPrice, currentBom,
    cart, addToCart, removeFromCart, clearCart, cartTotal
  };

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
};

// 옵션 계산 로직을 컨텍스트 외부의 헬퍼 함수로 분리
const getAvailableOptions = (productsData, selections) => {
    if (!productsData) return { versions: [], sizes: [], heights: [], levels: [], colors: [] };
    
    const { type, color, size, height } = selections;
    const product = productsData[type];
    const newOptions = { versions: [], sizes: [], heights: [], levels: [], colors: [] };

    if (product) {
        if (product.버전) newOptions.versions = Object.keys(product.버전);
        if (product.색상) newOptions.colors = product.색상;

        const priceDataSource = product.기본가격;
        if (type === '스텐랙' && priceDataSource) {
            newOptions.sizes = Object.keys(priceDataSource);
            if (size && priceDataSource[size]) {
                newOptions.heights = Object.keys(priceDataSource[size]);
                if (height && priceDataSource[size][height]) {
                    newOptions.levels = Object.keys(priceDataSource[size][height]);
                }
            }
        } else if (type === '하이랙' && color && priceDataSource[color]) {
            const sizeSource = priceDataSource[color];
            newOptions.sizes = Object.keys(sizeSource);
            if (size && sizeSource[size]) {
                newOptions.heights = Object.keys(sizeSource[size]);
                if (height && sizeSource[size][height]) {
                    newOptions.levels = Object.keys(sizeSource[size][height]);
                }
            }
        }
    }
    return newOptions;
};

export const useProducts = () => useContext(ProductContext);
