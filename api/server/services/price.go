package services

import (
	repositories "api/server/repositories"
	"strconv"
)

type PriceService struct {
	log             *LogService
	priceRepository *repositories.PriceRepository
}

func (ps *PriceService) InitPriceService(log *LogService, d *repositories.PriceRepository) error {
	// inject deps
	ps.log = log
	ps.priceRepository = d

	ps.log.Log(INFO, "Service: Price service initialized successfully")
	return nil
}

func (ps *PriceService) GetLatestPriceByMarket(marketId string) (float32, error) {
	priceSafeNumeric, err := ps.priceRepository.GetLatestPriceByMarket(marketId)
	if err != nil {
		return 0.0, ps.log.Log(ERROR, "failed to get latest price by market: %v", err)
	}
	priceFloat, err := strconv.ParseFloat(priceSafeNumeric, 32)
	if err != nil {
		return 0.0, ps.log.Log(ERROR, "failed to parse price: %v", err)
	}
	return float32(priceFloat), nil
}
