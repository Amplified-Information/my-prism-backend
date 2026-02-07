package services

import (
	"fmt"
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

type LogService struct {
	logger *zap.SugaredLogger
}

type LogLevel int

const (
	DEBUG LogLevel = iota
	INFO
	WARN
	ERROR
)

func (ls *LogService) InitLogger(level LogLevel) {
	var zapLevel zapcore.Level
	switch level {
	case DEBUG:
		zapLevel = zapcore.DebugLevel
	case INFO:
		zapLevel = zapcore.InfoLevel
	case WARN:
		zapLevel = zapcore.WarnLevel
	case ERROR:
		zapLevel = zapcore.ErrorLevel
	default:
		zapLevel = zapcore.InfoLevel
	}

	encoderCfg := zap.NewDevelopmentEncoderConfig()
	encoderCfg.EncodeLevel = zapcore.CapitalColorLevelEncoder                  // Colorize level
	encoderCfg.EncodeTime = zapcore.TimeEncoderOfLayout("2006-01-02 15:04:05") // Human-readable

	core := zapcore.NewCore(
		zapcore.NewConsoleEncoder(encoderCfg),
		zapcore.AddSync(zapcore.Lock(os.Stdout)),
		zap.NewAtomicLevelAt(zapLevel),
	)
	logger := zap.New(core)
	ls.logger = logger.Sugar()

	ls.logger.Infof("Service: Log service initialized successfully, %p", ls)
}

func (ls *LogService) Log(level LogLevel, msg string, args ...interface{}) error {
	// 1. logs with the appropriate warning level
	// 2. returns the output just logged
	switch level {
	case ERROR:
		ls.logger.Errorf(msg, args...)
	case WARN:
		ls.logger.Warnf(msg, args...)
	case INFO:
		ls.logger.Infof(msg, args...)
	case DEBUG:
		ls.logger.Debugf(msg, args...)
	}
	return fmt.Errorf(msg, args...)
}
