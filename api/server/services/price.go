package services

import (
	"api/server/lib"
	repositories "api/server/repositories"
	"strconv"
)

type PriceService struct {
	priceRepository *repositories.PriceRepository
}

func (ps *PriceService) InitPriceService(d *repositories.PriceRepository) error {
	// inject deps
	ps.priceRepository = d

	lib.Log(lib.LOG_INFO, "Service: Price service initialized successfully")
	return nil
}

func (ps *PriceService) GetLatestPriceByMarket(marketId string) (float32, error) {
	priceSafeNumeric, err := ps.priceRepository.GetLatestPriceByMarket(marketId)
	if err != nil {
		return 0.0, lib.LogAndError(lib.LOG_ERROR, "failed to get latest price by market: %v", err)
	}
	priceFloat, err := strconv.ParseFloat(priceSafeNumeric, 32)
	if err != nil {
		return 0.0, lib.LogAndError(lib.LOG_ERROR, "failed to parse price: %v", err)
	}
	return float32(priceFloat), nil
}
