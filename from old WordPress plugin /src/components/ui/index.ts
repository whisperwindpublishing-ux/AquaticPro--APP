/**
 * AquaticPro UI Component Library
 * 
 * This barrel file exports all reusable UI components from the design system.
 * Import components from here for consistent styling across the application.
 * 
 * @example
 * import { Button, Card, Input, Label } from './components/ui';
 * 
 * // Or import specific components
 * import { Button, PrimaryButton, DangerButton } from './components/ui/Button';
 */

// =============================================================================
// BUTTON COMPONENTS
// =============================================================================
export {
  Button,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  SuccessButton,
  GhostButton,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize,
} from './Button';

// =============================================================================
// CARD COMPONENTS
// =============================================================================
export {
  default as Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  type CardProps,
  type CardVariant,
  type CardPadding,
  type CardHeaderProps,
  type CardTitleProps,
  type CardDescriptionProps,
  type CardBodyProps,
  type CardFooterProps,
} from './Card';

// =============================================================================
// FORM COMPONENTS
// =============================================================================
export { Input, type InputProps, type InputSize } from './Input';
export { Select, type SelectProps } from './Select';
export { Textarea, type TextareaProps } from './Textarea';
export { Checkbox, type CheckboxProps } from './Checkbox';
export { Label, type LabelProps } from './Label';
export {
  FormField,
  FormHelper,
  FormError,
  FormGroup,
  type FormFieldProps,
  type FormHelperProps,
  type FormErrorProps,
  type FormGroupProps,
} from './FormField';

// =============================================================================
// MODAL COMPONENTS
// =============================================================================
export {
  default as Modal,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  type ModalProps,
  type ModalSize,
  type ModalHeaderProps,
  type ModalTitleProps,
  type ModalBodyProps,
  type ModalFooterProps,
} from './Modal';

// =============================================================================
// BADGE COMPONENTS
// =============================================================================
export {
  Badge,
  StatusBadge,
  type BadgeProps,
  type BadgeVariant,
  type BadgeSize,
} from './Badge';

// =============================================================================
// THEME UTILITIES
// =============================================================================
export {
  colors,
  typography,
  spacing,
  borders,
  shadows,
  buttonStyles,
  formStyles,
  cardStyles,
  modalStyles,
  tableStyles,
  badgeStyles,
  cn,
  getButtonClasses,
  getInputClasses,
} from '../../styles/theme';
