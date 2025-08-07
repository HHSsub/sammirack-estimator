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
  const [loading, setLoading] = useState(true);

  const [selectedType, setSelectedType] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [applyRate, setApplyRate] = useState(100);
  const [customPrice, setCustomPrice] = useState(0);
  const [isCustomPrice, setIsCustomPrice] = useState(false);

  const [cart, setCart] = useState([]);

  useEffect(() => {
    fetch('/sammirack-estimator/data.json')
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error('data.json 불러오기 실패:', err);
        setLoading(false);
      });
  }, []);

  const allOptions = useMemo(() => {
    const options = { types: [] };
    if (!data?.products) return options;

    data.products.forEach((product) => {
      if (!options.types.includes(product.type)) {
        options.types.push(product.type);
      }
    });

    return options;
  }, [data]);

  const availableOptions = useMemo(() => {
    if (!data || !selectedType) return {};

    const options = {
      versions: [],
      colors: [],
      sizes: [],
      heights: [],
      levels: []
    };

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

    if (['스텐랙', '하이랙'].includes(selectedType)) {
      const extra = data.EXTRA_OPTIONS?.[selectedType] || {};
      Object.keys(extra).forEach((key) => {
        extra[key].forEach((opt) => {
          if (!options[key].includes(opt)) options[key].push(opt);
        });
      });
    }

    return options;
  }, [data, selectedType]);

  const filteredOptions = useMemo(() => {
    if (!data || !selectedType) return {};

    const filtered = JSON.parse(JSON.stringify(availableOptions));
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

    return filtered;
  }, [data, selectedType, selectedOptions, availableOptions]);

  const isValidCombination = useMemo(() => {
    if (!data || !selectedType) return false;
    const { version, color, size, height, level } = selectedOptions;
    return data.products.some(
      (p) =>
        p.type === selectedType &&
        p.version === version &&
        p.color === color &&
        p.size === size &&
        p.height === height &&
        p.level === level
    );
  }, [data, selectedType, selectedOptions]);

  const price = useMemo(() => {
    if (isCustomPrice) return Number(customPrice) * quantity * (applyRate / 100);
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
    selectedType,
    selectedOptions,
    quantity,
    applyRate,
    customPrice,
    isCustomPrice,
    isValidCombination
  ]);

  const bom = useMemo(() => {
    if (!selectedType || !isValidCombination) return null;
    return BOMCalculator.calculateBOM({
      type: selectedType,
      ...selectedOptions
    });
  }, [selectedType, selectedOptions, isValidCombination]);

  const handleOptionChange = (key, value) => {
    setSelectedOptions((prev) => {
      const next = { ...prev, [key]: value };
      const hierarchy = ['type', 'version', 'color', 'size', 'height', 'level'];
      const index = hierarchy.indexOf(key);
      if (index >= 0) {
        for (let i = index + 1; i < hierarchy.length; i++) {
          next[hierarchy[i]] = '';
        }
      }
      return next;
    });
    if (key !== 'customPrice') setIsCustomPrice(false);
  };

  const addToCart = () => {
    const item = {
      id: Date.now(),
      displayName: `${selectedType} (${selectedOptions.version || ''} ${selectedOptions.color || ''} ${selectedOptions.size || ''} ${selectedOptions.height || ''} ${selectedOptions.level || ''})`,
      type: selectedType,
      options: { ...selectedOptions },
      selections: {
        quantity,
        applyRate
      },
      price,
      isCustomPrice,
      bom,
      timestamp: Date.now()
    };
    setCart((prev) => [...prev, item]);
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
    setSelectedType: (type) => handleOptionChange('type', type),
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
    price,
    bom,
    addToCart,
    cart,
    setCart,
    removeFromCart,
    cartTotal,
    loading
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
