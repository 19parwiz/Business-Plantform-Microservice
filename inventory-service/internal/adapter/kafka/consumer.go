package kafka

import (
	"log"

	"github.com/IBM/sarama"
	"google.golang.org/protobuf/proto"

	"github.com/19parwiz/inventory-service/internal/domain"
	"github.com/19parwiz/inventory-service/internal/usecase"
	events "github.com/19parwiz/inventory-service/protos/gen/golang"
)

type Consumer struct {
	usecase *usecase.Product
	Topic   string
}

func NewConsumer(usecase *usecase.Product, topic string) *Consumer {
	return &Consumer{usecase: usecase, Topic: topic}
}

func (h *Consumer) Setup(sarama.ConsumerGroupSession) error {
	return nil
}

func (h *Consumer) Cleanup(sarama.ConsumerGroupSession) error {
	return nil
}

func (h *Consumer) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for message := range claim.Messages() {
		var event events.OrderCreatedEvent
		if err := proto.Unmarshal(message.Value, &event); err != nil {
			log.Printf("kafka consumer: unmarshal OrderCreatedEvent: %v", err)
			continue
		}

		for _, item := range event.GetItems() {
			if item == nil {
				continue
			}
			productID := item.GetProductId()
			qty := item.GetQuantity()
			if productID == 0 || qty == 0 {
				log.Printf("kafka consumer: skip line item (product_id=%d quantity=%d)", productID, qty)
				continue
			}

			filter := domain.ProductFilter{ID: &productID}
			current, err := h.usecase.Get(session.Context(), filter)
			if err != nil {
				log.Printf("kafka consumer: get product_id=%d: %v", productID, err)
				continue
			}
			if current.Stock < qty {
				log.Printf("kafka consumer: insufficient stock product_id=%d have=%d need=%d", productID, current.Stock, qty)
				continue
			}

			newStock := current.Stock - qty
			update := domain.ProductUpdateData{Stock: &newStock}
			if err := h.usecase.Update(session.Context(), filter, update); err != nil {
				log.Printf("kafka consumer: update stock product_id=%d: %v", productID, err)
				continue
			}
		}

		session.MarkMessage(message, "")
	}
	return nil
}
