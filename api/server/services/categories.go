package services

import (
	sqlc "api/gen/sqlc"
	"api/server/lib"
	repositories "api/server/repositories"
)

type CategoriesService struct {
	categoriesRepository *repositories.CategoriesRepository
}

func (c *CategoriesService) Init(d *repositories.CategoriesRepository) error {
	c.categoriesRepository = d

	lib.Log(lib.LOG_INFO, "Service: Categories service initialized successfully")
	return nil
}

func (s *CategoriesService) CreateCategory(name string, isActive bool, description string) (*sqlc.Category, error) {
	result, err := s.categoriesRepository.CreateCategory(name, isActive, description)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "create category failed", err)
	}

	return result, nil
}

func (s *CategoriesService) UpdateCategory(id int32, name string, isActive bool, description string) (*sqlc.Category, error) {
	result, err := s.categoriesRepository.UpdateCategory(id, name, isActive, description)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "update category failed", err)
	}

	return result, nil
}

func (s *CategoriesService) DeleteCategory(id int32) error {
	err := s.categoriesRepository.DeleteCategory(id)
	if err != nil {
		return lib.LogAndError(lib.LOG_ERROR, "delete category failed", err)
	}

	return nil
}

func (s *CategoriesService) SetCategoriesForMarket(marketId string, categoryIds []int32) ([]int32, error) {
	result, err := s.categoriesRepository.SetCategoriesForMarket(marketId, categoryIds)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "set categories for market failed", err)
	}

	return result, nil
}
