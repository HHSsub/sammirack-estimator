const nameMap = {
  'upright_frame_st': '스텐랙 기둥',
  'shelf_st': '스텐랙 선반',
  'bolt_set_st': '고정볼트 세트',
  'upright_frame_hr_200': '하이랙 기둥 (200kg)',
  'shelf_hr_200': '하이랙 선반 (200kg)',
  'cross_beam_hr': '하이랙 가로대',
  'safety_pin_hr': '안전핀',
  'upright_frame_hr_350': '하이랙 강화기둥 (350kg)',
  'shelf_hr_350': '하이랙 강화선반 (350kg)',
  'upright_frame_hr_700': '파렛트랙 기둥 (700kg)',
  'load_beam_hr_700': '로드빔 (700kg)',
};

export const getKoreanName = (item) => {
  const baseName = nameMap[item.code] || item.code;
  const { height, size } = item.options || {};

  let finalName = baseName;
  if (height) finalName += ` ${height}`;
  if (size) finalName += ` ${size}`;

  return finalName;
};
