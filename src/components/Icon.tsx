import React from 'react';
import IoniconsIcon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import FeatherIcon from 'react-native-vector-icons/Feather';
import {useTheme} from '../context/ThemeContext';
import {ICON_SIZES} from '../lib/theme';

export type IconFamily = 'ionicons' | 'material' | 'feather';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  family?: IconFamily;
  style?: any;
}

/**
 * Unified Icon component wrapping react-native-vector-icons.
 * Defaults to Ionicons family with theme-aware defaults.
 */
const Icon: React.FC<IconProps> = ({
  name,
  size = ICON_SIZES.lg,
  color,
  family = 'ionicons',
  style,
}) => {
  const {colors} = useTheme();
  const iconColor = color ?? colors.textPrimary;

  switch (family) {
    case 'material':
      return (
        <MaterialCommunityIcon
          name={name}
          size={size}
          color={iconColor}
          style={style}
        />
      );
    case 'feather':
      return (
        <FeatherIcon name={name} size={size} color={iconColor} style={style} />
      );
    case 'ionicons':
    default:
      return (
        <IoniconsIcon name={name} size={size} color={iconColor} style={style} />
      );
  }
};

export default Icon;
