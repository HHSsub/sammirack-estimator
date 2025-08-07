import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo
} from 'react';
import { BOMCalculator } from '../utils/BOMCalculator';

const ProductContext = createContext();

export const ProductProvider = ({ children }) => {
  const [data, setData] = useState(null);
  const [bomData, setBomData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedType, setSelectedType] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [applyRate, setApplyRate] = useState(100);
  const [customPrice, setCustomPrice] = useState(0);
  const [isCustomPrice, setIsCustomPrice] = useState(false);

  const [cart, setCart] = useState([]);

  // Safe price formatter
  const safePrice = (value) =>
    typeof value === 'number' && !isNaN(value) ? value.toLocaleString() : '0';

  useEffect(() => {
    Promise.all([
      fetch('./data.json').then(res => res.json()),
      fetch('./bom_data.json').then(res => res.json())
    ])
    .then(([dataJson, bomJson]) => {
      setData(dataJson);
      setBomData(bomJson);
      setLoading(false);
    })
    .catch((err) => {
      console.error('데이터 불러오기 실패:', err);
      setLoading(false);
    });
  }, []);

  const allOptions = useMemo(() => {
    const options = { types: ['스탠랙', '하이랙', '경량랙', '중량랙', '파렛트랙'] };
    
    // Also add types from data.json if available
    if (data?.products) {
      data.products.forEach((product) => {
        if (!options.types.includes(product.type)) {
          options.types.push(product.type);
        }
      });
    }

    return options;
  }, [data]);

  const availableOptions = useMemo(() => {
    if (!selectedType) return {};

    const options = {
      versions: [],
      colors: [],
      sizes: [],
      heights: [],
      levels: []
    };

    // For Excel-based products, get options from BOM data
    if (['경량랙', '중량랙', '파렛트랙'].includes(selectedType) && bomData) {
      const productKey = selectedType;
      const productData = bomData[productKey];
      
      if (productData) {
        // Get sizes
        options.sizes = Object.keys(productData);
        console.log(`Found sizes for ${selectedType}:`, options.sizes);
        
        // Get heights from first size
        if (options.sizes.length > 0) {
          const sizeKey = selectedOptions.size || options.sizes[0];
          const firstSizeData = productData[sizeKey];
          if (firstSizeData) {
            options.heights = Object.keys(firstSizeData);
            console.log(`Found heights for ${selectedType}:`, options.heights);
            
            // Get levels from first height
            if (options.heights.length > 0) {
              const heightKey = selectedOptions.height || options.heights[0];
              const firstHeightData = firstSizeData[heightKey];
              if (firstHeightData) {
                const levelKeys = Object.keys(firstHeightData);
                options.levels = levelKeys.map((levelKey) => levelKey.replace('L', ''));
              }
            }
          }
        }
      } else {
        console.error(`No product data found for ${selectedType} in bomData`);
      }
      // Don't return early - allow processing to continue for other data sources
    }

    // For data.json based products
    if (data?.products) {
      const productsOfType = data.products.filter(
        (p) => p.type === selectedType
      );
      productsOfType.forEach((product) => {
        if (product.version) options.versions.push(product.version);
        if (product.color) options.colors.push(product.color);
        if (product.size) options.sizes.push(product.size);
        if (product.height) options.heights.push(product.height);
        if (product.level) options.levels.push(product.level);
      });

      if (['스탠랙', '하이랙'].includes(selectedType)) {
        const extra = data.EXTRA_OPTIONS?.[selectedType] || {};
        Object.keys(extra).forEach((key) => {
          extra[key].forEach((opt) => {
            if (!options[key].includes(opt)) options[key].push(opt);
          });
        });
      }
    }

    // Remove duplicates and sort
    Object.keys(options).forEach(key => {
      options[key] = [...new Set(options[key])].sort();
    });

    return options;
  }, [data, bomData, selectedType]);

  const filteredOptions = useMemo(() => {
    if (!selectedType) return {};

    // Start with a copy of availableOptions
    const filtered = JSON.parse(JSON.stringify(availableOptions));
    
    // Only do product-based filtering for data.json products
    if (data?.products && !['경량랙', '중량랙', '파렛트랙'].includes(selectedType)) {
      const products = data.products.filter((p) => p.type === selectedType);

      if (selectedOptions.version) {
        const targets = products.filter(
          (p) => p.version === selectedOptions.version
        );
        ['colors', 'sizes', 'heights', 'levels'].forEach((k) => {
          filtered[k] = [...new Set(targets.map((p) => p[k]).filter(Boolean))];
        });
      }

      if (selectedOptions.color) {
        const targets = products.filter(
          (p) => p.color === selectedOptions.color
        );
        ['sizes', 'heights', 'levels'].forEach((k) => {
          filtered[k] = [...new Set(targets.map((p) => p[k]).filter(Boolean))];
        });
      }

      if (selectedOptions.size) {
        const targets = products.filter(
          (p) => p.size === selectedOptions.size
        );
        ['heights', 'levels'].forEach((k) => {
          filtered[k] = [...new Set(targets.map((p) => p[k]).filter(Boolean))];
        });
      }

      if (selectedOptions.height) {
        const targets = products.filter(
          (p) => p.height === selectedOptions.height
        );
        filtered.levels = [
          ...new Set(targets.map((p) => p.level).filter(Boolean))
        ];
      }
    } 
    // For Excel-based products, filter based on selectedOptions
    else if (bomData && ['경량랙', '중량랙', '파렛트랙'].includes(selectedType)) {
      const productData = bomData[selectedType];
      
      const sizeKey = selectedOptions.size || Object.keys(productData)[0];
      const sizeData = productData[sizeKey];
      if (sizeData) {
        filtered.heights = Object.keys(sizeData);
        const heightKey = selectedOptions.height || filtered.heights[0];
        const heightData = sizeData[heightKey];
        if (heightData) {
          const levelKeys = Object.keys(heightData);
          filtered.levels = levelKeys.map((levelKey) => levelKey.replace('L', ''));
        }
      }
      console.log('Filtered options for Excel product:', filtered);
    }

    return filtered;
  }, [data, bomData, selectedType, selectedOptions, availableOptions]);

  const isValidCombination = useMemo(() => {
    // If no data or no selected type, return false
    if (!data || !selectedType) return false;
    
    // For Excel-based products, use a different validation method
    if (['경량랙', '중량랙', '파렛트랙'].includes(selectedType)) {
      if (!bomData) return false;
      const { size, height, level } = selectedOptions;
      
      // Check if the options exist in bomData
      const productData = bomData[selectedType];
      if (!productData) return false;
      
      if (!size || !productData[size]) return false;
      
      const sizeData = productData[size];
      if (!height || !sizeData[height]) return false;
      
      const heightData = sizeData[height];
      const levelKey = level ? `L${level}` : null;
      if (!levelKey || !heightData[levelKey]) return false;
      
      return true;
    }
    
    // For data.json based products (스텐랙, 하이랙)
    const { version, color, size, height, level } = selectedOptions;
    if (!data.products) return false;
    
    return data.products.some(
      (p) =>
        p.type === selectedType &&
        (selectedType === '스탠랙' || p.version === version) &&
        (p.color === color || !color) &&
        p.size === size &&
        p.height === height &&
        p.level === level
    );
  }, [data, bomData, selectedType, selectedOptions]);


  const price = useMemo(() => {
    if (isCustomPrice) return Number(customPrice) * quantity * (applyRate / 100);
    
    // For Excel-based products, calculate price from BOM data
    if (['경량랙', '중량랙', '파렛트랙'].includes(selectedType) && bomData) {
      const bomPrice = getBOMPriceFromExcelData(selectedType, selectedOptions, quantity);
      return bomPrice * (applyRate / 100);
    }
    
    // For data.json based products
    if (!data?.products || !isValidCombination) return 0;

    const product = data.products.find(
      (p) =>
        p.type === selectedType &&
        p.version === selectedOptions.version &&
        p.color === selectedOptions.color &&
        p.size === selectedOptions.size &&
        p.height === selectedOptions.height &&
        p.level === selectedOptions.level
    );

    return product ? product.price * quantity * (applyRate / 100) : 0;
  }, [
    data,
    bomData,
    selectedType,
    selectedOptions,
    quantity,
    applyRate,
    customPrice,
    isCustomPrice,
    isValidCombination
  ]);

  const getBOMPriceFromExcelData = (type, options, quantity) => {
    if (!bomData || !options.size || !options.height || !options.level) return 0;
    
    const productKey = type;
    const productData = bomData[productKey];
    
    if (!productData) return 0;
    
    const sizeData = productData[options.size];
    if (!sizeData) return 0;
    
    const heightData = sizeData[options.height];
    if (!heightData) return 0;
    
    const levelKey = options.level ? `L${options.level}` : null;
    const levelData = heightData[levelKey];
    if (!levelData) return 0;

    if (!levelKey || !heightData[levelKey]) return 0;
    
    // Get the first configuration (독립형 or 연결형)
    const configKeys = Object.keys(levelData);
    if (configKeys.length === 0) return 0;
    
    const config = levelData[configKeys[0]];
    return (config.total_price || 0) * quantity;
  };

  const bom = useMemo(() => {
    if (!selectedType) return [];
    
    // For Excel-based products (경량랙, 중량랙, 파렛트랙)
    if (['경량랙', '중량랙', '파렛트랙'].includes(selectedType)) {
      // Check if we have the required data and options
      if (bomData && selectedOptions.size && selectedOptions.height && selectedOptions.level) {
        return getBOMFromExcelData(selectedType, selectedOptions, quantity);
      }
      return [];
    }
    
    // For 스탠랙 and 하이랙
    // Only calculate if we have a valid combination or custom price
    if (!isValidCombination && !isCustomPrice) return [];
    
    const calculator = new BOMCalculator();
    return calculator.calculateBOM(selectedType, selectedOptions, quantity);
  }, [selectedType, selectedOptions, quantity, isValidCombination, isCustomPrice, bomData]);


  const getBOMFromExcelData = (type, options, quantity) => {
    if (!bomData || !options.size || !options.height || !options.level) return [];
    
    const productKey = type;
    const productData = bomData[productKey];
    
    if (!productData) return [];
    
    const sizeData = productData[options.size];
    if (!sizeData) return [];
    
    const heightData = sizeData[options.height];
    if (!heightData) return [];
    
    const levelKey = `L${options.level}`;
    const levelData = heightData[levelKey];
    if (!levelData) return [];
    
    // Get the first configuration (독립형 or 연결형)
    const configKeys = Object.keys(levelData);
    if (configKeys.length === 0) return [];
    
    const config = levelData[configKeys[0]];
    if (!config.components) return [];
    
    return config.components.map(component => ({
      code: component.name,
      name: component.name,
      quantity: component.quantity * quantity,
      unitPrice: component.unit_price || 0,
      totalPrice: (component.unit_price || 0) * component.quantity * quantity,
      options: {}
    }));
  };

  const handleOptionChange = (key, value) => {
    setSelectedOptions((prev) => {
      const next = { ...prev, [key]: value };
      
      // If changing the product type, reset all selections
      if (key === 'type') {
        return { 
          version: '',
          color: '',
          size: '',
          height: '',
          level: ''
        };
      }
      
      // For other options, follow hierarchy
      const hierarchy = ['version', 'color', 'size', 'height', 'level'];
      const index = hierarchy.indexOf(key);
      if (index >= 0) {
        for (let i = index + 1; i < hierarchy.length; i++) {
          next[hierarchy[i]] = '';
        }
      }
      return next;
    });
    
    // Reset custom price when changing options
    if (key !== 'customPrice') setIsCustomPrice(false);
    
    console.log(`Option changed: ${key} = ${value}`);
  };

  const addToCart = () => {
    const item = {
      id: Date.now(),
      displayName: `${selectedType} (${selectedOptions.version || ''} ${selectedOptions.color || ''} ${selectedOptions.size || ''} ${selectedOptions.height || ''} ${selectedOptions.level || ''}단)`,
      type: selectedType,
      options: { ...selectedOptions },
      selections: {
        quantity,
        applyRate
      },
      price,
      isCustomPrice,
      bom: bom || [],
      timestamp: Date.now()
    };
    setCart((prev) => [...prev, item]);
    
    // Save to localStorage for history
    const history = JSON.parse(localStorage.getItem('estimateHistory') || '[]');
    history.unshift(item);
    localStorage.setItem('estimateHistory', JSON.stringify(history.slice(0, 100))); // Keep only last 100
    
    return item;
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price, 0);
  }, [cart]);

  const value = {
    allOptions,
    availableOptions,
    filteredOptions,
    selectedType,
    selectedOptions,
    setSelectedType: (type) => {
      setSelectedOptions({
        version: '',
        color: '',
        size: '',
        height: '',
        level: ''
      });
      setSelectedType(type);
      console.log(`Product type changed to: ${type}`);
    },
    handleOptionChange,
    quantity,
    setQuantity,
    applyRate,
    setApplyRate,
    customPrice,
    setCustomPrice,
    isCustomPrice,
    setIsCustomPrice,
    isValidCombination,
    currentPrice: price,
    currentBom: bom,
    addToCart,
    cart,
    setCart,
    removeFromCart,
    cartTotal,
    loading,
    safePrice
  };

  return (
    <ProductContext.Provider value={value}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProduct = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error('useProduct must be used within a ProductProvider');
  }
  return context;
};

export const useProducts = useProduct;
