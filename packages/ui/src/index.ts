// Utilities
export { cn } from './lib/cn';
export { usd } from './lib/format';
export { calculateScaledBox } from './lib/bbox';
export type { ScaledBoundingBox } from './lib/bbox';
export { applyThemeMode, readThemeMode, ACCENTS, readAccent, applyAccent, readDensity, applyDensity } from './lib/theme';
export type { ThemeMode, Accent, Density } from './lib/theme';

// Real boot-screen progress
export { bootStart, bootStep, bootDone, settleWithin, windowLoaded, imageReady } from './boot/boot';
export { useBootMilestones } from './boot/useBootMilestones';
export type { BootMilestone } from './boot/useBootMilestones';

// Hooks
export { useToasts } from './hooks/useToasts';
export type { ToastMessage, ToastTone, Toasts } from './hooks/useToasts';
export { useCopy } from './hooks/useCopy';
export { useResource } from './hooks/useResource';
export { useNow } from './hooks/useNow';
export type { Resource } from './hooks/useResource';
export { useRoute, scrollToId } from './routing/useRoute';

// Motion
export { useMediaQuery } from './motion/useMediaQuery';
export { useMotionMode } from './motion/useMotionMode';
export type { MotionMode } from './motion/useMotionMode';
export { usePointerTilt } from './motion/usePointerTilt';
export type { PointerTilt } from './motion/usePointerTilt';

// Components
export { Icon } from './components/Icon';
export type { IconName } from './components/Icon';
export { Button } from './components/Button';
export type { ButtonProps } from './components/Button';
export { Input } from './components/Input';
export { Select } from './components/Select';
export type { SelectOption } from './components/Select';
export { Card } from './components/Card';
export { TiltCard } from './components/TiltCard';
export { Chip } from './components/Chip';
export type { ChipVariant } from './components/Chip';
export { Alert } from './components/Alert';
export { Modal } from './components/Modal';
export { Drawer } from './components/Drawer';
export type { DrawerProps } from './components/Drawer';
export { ConfirmModal } from './components/ConfirmModal';
export { ApiKeyRevealModal } from './components/ApiKeyRevealModal';
export { CopyButton } from './components/CopyButton';
export { ToastContainer } from './components/ToastContainer';
export { ToastProvider, useNotify } from './components/ToastProvider';
export { ThemeToggle } from './components/ThemeToggle';
export { ProgressBar } from './components/ProgressBar';
export { AnimatedNumber } from './components/AnimatedNumber';
export { Skeleton } from './components/Skeleton';
export { PageHeader } from './components/PageHeader';
export { StatCard } from './components/StatCard';
export { EmptyState } from './components/EmptyState';
export { SegmentedControl } from './components/SegmentedControl';
export type { Segment } from './components/SegmentedControl';
export { Table, THead, Th, Tr, Td } from './components/Table';
export { Reveal } from './components/Reveal';
export { LayertoLogo, LOGO_NATIVE_PX } from './components/LayertoLogo';
export { UploadZone, validateImageFile, ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from './components/UploadZone';
export { UsageChart } from './components/UsageChart';
export type { ChartDay } from './components/UsageChart';
export { BoundingBoxCanvas } from './components/BoundingBoxCanvas';
export type { Prediction } from './components/BoundingBoxCanvas';

// App layouts (dashboard + admin)
export { AppShell } from './components/app/AppShell';
export { AuthLayout } from './components/app/AuthLayout';
export { StatusScreen } from './components/app/StatusScreen';
export type { NavItem, AccountMenuItem } from './components/app/types';

export { PasswordInput } from './components/PasswordInput';
export type { PasswordInputProps } from './components/PasswordInput';
export { PasswordChecklist } from './components/PasswordChecklist';
export { ChangePasswordForm } from './components/ChangePasswordForm';
export { passwordChecks, passwordValid, passwordStrength, STRENGTH_LABELS, MIN_PASSWORD } from './lib/passwordPolicy';
export type { PasswordCheck } from './lib/passwordPolicy';
export { normalizeUsername, usernameProblem, USERNAME_HINT } from './lib/username';
export { Switch } from './components/Switch';
export type { SwitchProps } from './components/Switch';
export { formatExpiryDisplay, getKeyStatus, isKeyExpired, isKeyExpiringSoon, timeLeft } from './lib/keyStatus';
export type { KeyStatusInfo, KeyStatusVariant } from './lib/keyStatus';
export { ModelSiteView } from './components/ModelSiteView';
export type { ModelSiteViewProps } from './components/ModelSiteView';
export { Markdown } from './components/Markdown';
export { LineChart } from './components/LineChart';
export type { LineSeries } from './components/LineChart';
export { MetricsPanel, METRIC_INFO, formatMetric } from './components/MetricsPanel';
export { Tabs } from './components/Tabs';
export type { TabItem } from './components/Tabs';
export { Avatar } from './components/Avatar';

// Reusable Research Ecosystem components
export { ResearchAreaBadge, GeoShieldBadge, AdaptivePrivacyShieldBadge, AirGappedVaultCard, CRediTRoleTag } from './components/ResearchBadges';
export type { ResearchAreaBadgeProps, GeoShieldBadgeProps, AdaptivePrivacyShieldBadgeProps, AirGappedVaultCardProps, CRediTRoleTagProps } from './components/ResearchBadges';
