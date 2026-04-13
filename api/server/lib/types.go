package lib

import (
	"errors"
	"fmt"
	"os"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

type ValidNetworksType string

const (
	TESTNET    ValidNetworksType = "testnet"
	MAINNET    ValidNetworksType = "mainnet"
	PREVIEWNET ValidNetworksType = "previewnet"
	// Future network types
)

type HederaKeyType uint32

const (
	KEY_TYPE_INVALID HederaKeyType = 0
	KEY_TYPE_ED25519 HederaKeyType = 1
	KEY_TYPE_ECDSA   HederaKeyType = 2
	// Future key types
)

type RolesType string

const (
	ADMIN RolesType = "ADMIN"
	USER  RolesType = "USER"
	// Future roles
)

// price/distance/duration tiers:
type PriceDistanceTier struct {
	Threshold float64 // percent distance from market price (e.g., 0.20 for 20%)
	Weight    int
}
type OrderDurationTier struct {
	Duration time.Duration
	Weight   int
}

// Zap logger setup
var zapLogger = zap.NewNop().Sugar()

func SetZapLogger(l *zap.SugaredLogger) {
	if l != nil {
		zapLogger = l
	}
}

func InitZapLogger(level int) {
	var zapLevel zapcore.Level
	switch level {
	case LOG_DEBUG:
		zapLevel = zapcore.DebugLevel
	case LOG_INFO:
		zapLevel = zapcore.InfoLevel
	case LOG_WARN:
		zapLevel = zapcore.WarnLevel
	case LOG_ERROR:
		zapLevel = zapcore.ErrorLevel
	default:
		zapLevel = zapcore.InfoLevel
	}

	encoderCfg := zap.NewDevelopmentEncoderConfig()
	encoderCfg.EncodeLevel = zapcore.CapitalColorLevelEncoder
	encoderCfg.EncodeTime = zapcore.TimeEncoderOfLayout("2006-01-02 15:04:05")

	core := zapcore.NewCore(
		zapcore.NewConsoleEncoder(encoderCfg),
		zapcore.AddSync(zapcore.Lock(os.Stdout)),
		zap.NewAtomicLevelAt(zapLevel),
	)

	logger := zap.New(core)
	SetZapLogger(logger.Sugar())
}

func Debug(msg string, keysAndValues ...interface{}) {
	zapLogger.Debugw(msg, keysAndValues...)
}

func Info(msg string, keysAndValues ...interface{}) {
	zapLogger.Infow(msg, keysAndValues...)
}

func Warn(msg string, keysAndValues ...interface{}) {
	zapLogger.Warnw(msg, keysAndValues...)
}

func Error(msg string, keysAndValues ...interface{}) {
	zapLogger.Errorw(msg, keysAndValues...)
}

func ErrorLog(msg string, keysAndValues ...interface{}) error {
	Error(msg, keysAndValues...)

	var wrappedErr error

	for i := 0; i+1 < len(keysAndValues); i += 2 {
		key, ok := keysAndValues[i].(string)
		if !ok || key != "error" {
			continue
		}

		err, ok := keysAndValues[i+1].(error)
		if ok && err != nil {
			wrappedErr = err
			break
		}
	}

	if wrappedErr == nil {
		for _, value := range keysAndValues {
			err, ok := value.(error)
			if ok && err != nil {
				wrappedErr = err
				break
			}
		}
	}

	if wrappedErr != nil {
		return fmt.Errorf("%s: %w", msg, wrappedErr)
	}

	return errors.New(msg)
}

func Log(level int, msg string, args ...interface{}) {
	switch level {
	case LOG_ERROR:
		zapLogger.Errorf(msg, args...)
	case LOG_WARN:
		zapLogger.Warnf(msg, args...)
	case LOG_INFO:
		zapLogger.Infof(msg, args...)
	default:
		zapLogger.Debugf(msg, args...)
	}
}

func LogError(err error, msg string, args ...interface{}) error {
	formatted := msg
	if len(args) > 0 {
		formatted = fmt.Sprintf(msg, args...)
	}
	if err != nil {
		return ErrorLog(formatted, "error", err)
	}

	return ErrorLog(formatted)
}

func LogAndError(level int, msg string, args ...interface{}) error {
	Log(level, msg, args...)
	return fmt.Errorf(msg, args...)
}
